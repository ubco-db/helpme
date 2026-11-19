/**
 * Small, dependency-free ESLint rules for problems that have bitten this
 * codebase before. They are intentionally AST-only (no type information) so
 * they stay cheap enough to run on every save/commit.
 *
 */

'use strict';

function getMemberPropertyName(node) {
  if (
    node.type !== 'MemberExpression' ||
    node.computed ||
    node.property.type !== 'Identifier'
  ) {
    return undefined;
  }
  return node.property.name;
}

function isCallTo(node, name) {
  return (
    node.type === 'CallExpression' &&
    getMemberPropertyName(node.callee) === name
  );
}

/** Nodes that only wrap an expression and do not change its value. */
const TRANSPARENT_WRAPPERS = new Set([
  'AwaitExpression',
  'ChainExpression',
  'ConditionalExpression',
  'LogicalExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/**
 * Finds the variable that a `createQueryRunner()` result is assigned to.
 * Returns `undefined` when the call is used inline (which leaks the runner).
 */
function findAssignedIdentifier(callNode) {
  let node = callNode;
  while (node.parent) {
    const parent = node.parent;
    if (
      parent.type === 'VariableDeclarator' &&
      parent.init &&
      parent.id.type === 'Identifier'
    ) {
      return parent.id;
    }
    if (
      parent.type === 'AssignmentExpression' &&
      parent.right === node &&
      parent.left.type === 'Identifier'
    ) {
      return parent.left;
    }
    if (!TRANSPARENT_WRAPPERS.has(parent.type)) {
      return undefined;
    }
    node = parent;
  }
  return undefined;
}

function findVariable(scope, name) {
  let current = scope;
  while (current) {
    const variable = current.variables.find((entry) => entry.name === name);
    if (variable) {
      return variable;
    }
    current = current.upper;
  }
  return undefined;
}

function isDescendant(ancestor, node) {
  let current = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * True when `releaseNode` sits in the `finally` block of a `try`. This is the
 * only placement that guarantees the runner is released when the body throws.
 */
function isReleasedInFinally(releaseNode) {
  let current = releaseNode;
  while (current) {
    if (
      current.type === 'TryStatement' &&
      current.finalizer &&
      isDescendant(current.finalizer, releaseNode)
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

module.exports = {
  meta: {
    name: 'eslint-plugin-helpme',
    version: '1.0.0',
  },
  rules: {
    /**
     * `dataSource.synchronize(true)` drops and recreates the entire schema.
     * On Docker/overlayfs this costs 1-2 seconds per call, which dominated the
     * old test suite. Use `resetDatabase(dataSource)` from
     * `test/util/testUtils.ts` instead (it runs DELETE + sequence resets).
     */
    'no-synchronize-drop': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow dropping and recreating the schema with synchronize(true)',
        },
        schema: [],
        messages: {
          useResetDatabase:
            'Calling `synchronize(true)` drops and recreates every table (~1-2s). Use `resetDatabase(dataSource)` from `test/util/testUtils.ts` instead. See docs/PLAN.md.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              getMemberPropertyName(node.callee) !== 'synchronize' ||
              node.arguments.length !== 1
            ) {
              return;
            }
            const [options] = node.arguments;
            if (options.type === 'Literal' && options.value === true) {
              context.report({ node, messageId: 'useResetDatabase' });
            }
          },
        };
      },
    },

    /**
     * `FLUSHALL` wipes every Redis logical database, including other Jest
     * workers' data. Tests must use `flushdb()` (their own logical DB).
     */
    'no-redis-flushall': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow wiping every Redis database with FLUSHALL',
        },
        schema: [],
        messages: {
          useFlushDb:
            '`flushall()` wipes every Redis logical database, including other tests/workers. Use `flushdb()` instead (each test worker owns its own Redis DB).',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            const name = getMemberPropertyName(node.callee);
            if (name === 'flushall' || name === 'flushAll') {
              context.report({ node, messageId: 'useFlushDb' });
            }
          },
        };
      },
    },

    /**
     * Query runners borrow a connection from the pool. Forgetting `release()`
     * leaks it until the pool is exhausted (which shows up as an unrelated
     * hang, especially with the small pools used in parallel tests).
     */
    'require-query-runner-release': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require every TypeORM query runner to be released, ideally in a finally block',
        },
        schema: [],
        messages: {
          storeResult:
            'Store the `createQueryRunner()` result in a variable and `await queryRunner.release()` in a `finally` block (an inline runner cannot be released).',
          missingRelease:
            'This query runner is never released. Add `await {{name}}.release()` in a `finally` block so the connection returns to the pool.',
          releaseInFinally:
            'Release `{{name}}` in a `finally` block, not only on the happy path, so it is released when the body throws.',
        },
      },
      create(context) {
        const sourceCode = context.sourceCode;
        /** @type {Map<object, any[]>} variable -> acquire nodes */
        const acquires = new Map();
        /** @type {Map<object, any[]>} variable -> release nodes */
        const releases = new Map();
        const unresolvedAcquires = [];

        return {
          CallExpression(node) {
            if (!isCallTo(node, 'createQueryRunner')) {
              return;
            }
            const identifier = findAssignedIdentifier(node);
            if (!identifier) {
              unresolvedAcquires.push(node);
              return;
            }
            const variable = findVariable(
              sourceCode.getScope(identifier),
              identifier.name,
            );
            if (!variable) {
              return;
            }
            const list = acquires.get(variable) ?? [];
            list.push(node);
            acquires.set(variable, list);
          },
          'CallExpression:exit'(node) {
            if (!isCallTo(node, 'release')) {
              return;
            }
            const callee = node.callee;
            if (callee.object.type !== 'Identifier') {
              return;
            }
            const variable = findVariable(
              sourceCode.getScope(callee.object),
              callee.object.name,
            );
            if (!variable) {
              return;
            }
            const list = releases.get(variable) ?? [];
            list.push(node);
            releases.set(variable, list);
          },
          'Program:exit'() {
            for (const node of unresolvedAcquires) {
              context.report({
                node,
                messageId: 'storeResult',
              });
            }
            for (const [variable, acquireNodes] of acquires) {
              const releaseNodes = releases.get(variable) ?? [];
              for (const acquireNode of acquireNodes) {
                if (releaseNodes.length === 0) {
                  context.report({
                    node: acquireNode,
                    messageId: 'missingRelease',
                    data: { name: variable.name },
                  });
                  continue;
                }
                if (!releaseNodes.some(isReleasedInFinally)) {
                  context.report({
                    node: acquireNode,
                    messageId: 'releaseInFinally',
                    data: { name: variable.name },
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};
