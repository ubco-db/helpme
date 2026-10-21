// This file is just for testing the linter (for timing differences and making sure it works)
const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const { ESLint } = require('eslint')

const root = path.resolve(__dirname, '../..')
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: path.join(root, 'eslint.fast.config.js'),
})
const frontendFile = 'packages/frontend/lint-probe.tsx'
const serverFile = 'packages/server/src/lint-probe.ts'

async function lint(source, filePath, options = {}) {
  const instance = Object.keys(options).length
    ? new ESLint({
        cwd: root,
        overrideConfigFile: path.join(root, 'eslint.fast.config.js'),
        ...options,
      })
    : eslint
  const [result] = await instance.lintText(source, { filePath })
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages))
  assert.ok(
    !result.messages.some((message) =>
      message.message.includes('File ignored'),
    ),
    JSON.stringify(result.messages),
  )
  return result
}

test('all workspaces select TypeScript without loading TypeScript projects', async () => {
  for (const file of [
    serverFile,
    frontendFile,
    'packages/common/lint-probe.ts',
  ]) {
    const config = await eslint.calculateConfigForFile(path.join(root, file))
    assert.ok(config, file)
    assert.equal(config.languageOptions.parserOptions.project, false)
    assert.equal(config.languageOptions.parserOptions.projectService, false)
    const result = await lint(
      'export const unused = 1\nconst forgotten = 2',
      file,
    )
    assert.ok(
      result.messages.some(
        (message) => message.ruleId === '@typescript-eslint/no-unused-vars',
      ),
      file,
    )
  }
})

test('Hooks dependency warnings are frontend-only and are not auto-fixed', async () => {
  const source = `
    import { useEffect } from 'react'
    export function Probe({ value }: { value: number }) {
      useEffect(() => { console.log(value) }, [])
      return null
    }
  `
  const result = await lint(source, frontendFile, { fix: true })
  const warning = result.messages.find(
    (message) => message.ruleId === 'react-hooks/exhaustive-deps',
  )
  assert.equal(warning?.severity, 1)
  assert.match(result.output || source, /\}, \[\]\)/)
  const serverConfig = await eslint.calculateConfigForFile(
    path.join(root, serverFile),
  )
  assert.equal(serverConfig.rules['react-hooks/exhaustive-deps'], undefined)
  assert.equal(serverConfig.rules['react-hooks/rules-of-hooks'], undefined)
  const frontendConfig = await eslint.calculateConfigForFile(
    path.join(root, frontendFile),
  )
  assert.equal(
    frontendConfig.rules['react-hooks/set-state-in-effect'],
    undefined,
  )
})

test('the automatic JSX runtime does not mark unused React imports as used', async () => {
  const result = await lint(
    `
    import React from 'react'
    export function Probe() { return <div /> }
  `,
    frontendFile,
  )
  assert.ok(
    result.messages.some(
      (message) =>
        message.ruleId === '@typescript-eslint/no-unused-vars' &&
        message.message.includes("'React'"),
    ),
  )
})

test('conditional Hooks are errors', async () => {
  const result = await lint(
    `
    import { useEffect } from 'react'
    export function Probe({ enabled }: { enabled: boolean }) {
      if (enabled) useEffect(() => {}, [])
      return null
    }
  `,
    frontendFile,
  )
  assert.ok(
    result.messages.some(
      (message) =>
        message.ruleId === 'react-hooks/rules-of-hooks' &&
        message.severity === 2,
    ),
  )
})

test('missing JSX keys and Next.js mistakes are checked', async () => {
  const result = await lint(
    `
    import Document from 'next/document'
    export function Probe() {
      return <Document>{[1, 2].map(value => <span>{value}</span>)}</Document>
    }
  `,
    frontendFile,
  )
  assert.ok(
    result.messages.some((message) => message.ruleId === 'react/jsx-key'),
  )
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === '@next/next/no-document-import-in-page',
    ),
  )
})

test('focused tests remain blocked and intentional underscore arguments are allowed', async () => {
  const result = await lint(
    `
    describe.only('probe', () => {})
    export function probe(_unused: string) { return 1 }
  `,
    serverFile,
  )
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === 'no-only-tests/no-only-tests',
    ),
  )
  assert.ok(
    !result.messages.some(
      (message) => message.ruleId === '@typescript-eslint/no-unused-vars',
    ),
  )
})

test('safe type-only imports can be fixed in undecorated code', async () => {
  const result = await lint(
    `
    import { Request } from 'express'
    export type Probe = Request
  `,
    serverFile,
    { fix: true },
  )
  assert.match(result.output, /import type \{ Request \}/)
})

test('autofixes preserve runtime imports for Nest DI and TypeORM metadata', async () => {
  for (const [filePath, source] of [
    [
      serverFile,
      `
      import { Injectable } from '@nestjs/common'
      import { AlertsService } from './alerts/alerts.service'
      @Injectable()
      export class Probe {
        constructor(private readonly service: AlertsService) {}
      }
    `,
    ],
    [
      'packages/server/src/lint-probe.entity.ts',
      `
      import { Column, Entity } from 'typeorm'
      import { UserModel } from './profile/user.entity'
      @Entity()
      export class Probe {
        @Column()
        user: UserModel
      }
    `,
    ],
  ]) {
    const result = await lint(source, filePath, { fix: true })
    assert.doesNotMatch(result.output || source, /import type/)
    assert.ok(
      !result.messages.some(
        (message) =>
          message.ruleId === '@typescript-eslint/consistent-type-imports',
      ),
    )
  }
})

test('generated output is ignored from both root and frontend working directories', async () => {
  for (const cwd of [root, path.join(root, 'packages/frontend')]) {
    const instance = new ESLint({ cwd })
    for (const file of [
      'packages/frontend/.next/types/probe.ts',
      'packages/frontend/next-env.d.ts',
      'packages/server/dist/probe.ts',
      'packages/server/coverage/probe.ts',
    ]) {
      assert.equal(
        await instance.isPathIgnored(path.join(root, file)),
        true,
        `${cwd}: ${file}`,
      )
    }
  }
})

test('frontend and root working directories resolve the same rules', async () => {
  const nested = new ESLint({ cwd: path.join(root, 'packages/frontend') })
  const file = path.join(root, frontendFile)
  const discovered = new ESLint({ cwd: root })
  const fromRoot = await discovered.calculateConfigForFile(file)
  const fromFrontend = await nested.calculateConfigForFile(file)
  assert.deepEqual(fromFrontend.rules, fromRoot.rules)
  assert.deepEqual(
    fromFrontend.languageOptions.parserOptions,
    fromRoot.languageOptions.parserOptions,
  )
})

test('full Promise checks select each workspace project without affecting fast checks', async () => {
  const full = new ESLint({
    cwd: root,
    overrideConfigFile: path.join(root, 'eslint.full.config.js'),
  })
  for (const [workspace, file] of [
    ['server', serverFile],
    ['frontend', frontendFile],
    ['common', 'packages/common/lint-probe.ts'],
  ]) {
    const normal = await eslint.calculateConfigForFile(path.join(root, file))
    const config = await full.calculateConfigForFile(path.join(root, file))
    assert.deepEqual(config.languageOptions.parserOptions.project, [
      `./packages/${workspace}/tsconfig.json`,
    ])
    for (const rule of [
      '@typescript-eslint/no-floating-promises',
      '@typescript-eslint/no-misused-promises',
      '@typescript-eslint/await-thenable',
    ]) {
      assert.equal(normal.rules[rule], undefined)
      assert.equal(config.rules[rule][0], 1)
    }
  }
})

test('editor auto-discovery selects exactly the full rules', async () => {
  const explicit = new ESLint({
    cwd: root,
    overrideConfigFile: path.join(root, 'eslint.full.config.js'),
  })
  const automatic = new ESLint({ cwd: root })
  const file = path.join(root, frontendFile)
  const discovered = await automatic.calculateConfigForFile(file)
  const full = await explicit.calculateConfigForFile(file)
  assert.deepEqual(discovered.rules, full.rules)
  assert.deepEqual(
    discovered.languageOptions.parserOptions,
    full.languageOptions.parserOptions,
  )
})

test('commit fixes are fast and limited to the staged file list', () => {
  const manifest = require('../../package.json')
  const tasks = manifest['lint-staged']['packages/**/*.{ts,tsx}']
  assert.deepEqual(tasks, [
    'prettier --write',
    'eslint --config eslint.fast.config.js --fix',
  ])
  for (const mode of ['fast', 'full']) {
    const command = `eslint --config eslint.${mode}.config.js packages/`
    assert.equal(manifest.scripts[`lint:${mode}`], command)
    assert.equal(manifest.scripts[`lint:${mode}:fix`], `${command} --fix`)
  }
  assert.equal(manifest.scripts['lint:types'], undefined)
  assert.equal(manifest.scripts.lint, 'yarn lint:full')
})

test('production builds check TypeScript without running ESLint', () => {
  const manifest = require('../../package.json')
  const frontend = require('../../packages/frontend/package.json')
  assert.equal(manifest.scripts.prebuild, 'yarn tsc')
  assert.equal(manifest.scripts['prebuild:dev'], 'yarn tsc')
  assert.equal(frontend.scripts.tsc, 'next typegen && tsc --noEmit')
  for (const script of ['prebuild', 'build', 'prebuild:dev', 'build:dev']) {
    assert.doesNotMatch(manifest.scripts[script], /eslint|lint:/)
  }
  assert.doesNotMatch(frontend.scripts.build, /eslint|lint:/)
})

test('editor saves format with Prettier without applying ESLint fixes', () => {
  const fs = require('node:fs')
  const { parseConfigFileTextToJson } = require('typescript')
  function readSettings(file) {
    const result = parseConfigFileTextToJson(
      file,
      fs.readFileSync(path.join(root, file), 'utf8'),
    )
    assert.equal(result.error, undefined)
    return result.config
  }
  const vscode = readSettings('.vscode/settings.json')
  assert.deepEqual(vscode['eslint.workingDirectories'], [{ mode: 'location' }])
  assert.equal(vscode['eslint.run'], 'onType')
  for (const language of ['typescript', 'typescriptreact']) {
    assert.equal(
      vscode[`[${language}]`]['editor.defaultFormatter'],
      'esbenp.prettier-vscode',
    )
    assert.equal(
      vscode[`[${language}]`]['editor.codeActionsOnSave'][
        'source.fixAll.eslint'
      ],
      'never',
    )
  }
  const zed = readSettings('.zed/settings.json')
  assert.equal(zed.lsp.eslint.settings.workingDirectory.mode, 'location')
  for (const language of ['TypeScript', 'TSX']) {
    assert.equal(zed.languages[language].formatter, 'prettier')
    assert.equal(
      zed.languages[language].code_actions_on_format['source.fixAll.eslint'],
      false,
    )
  }
  const extensions = readSettings('.vscode/extensions.json')
  for (const extension of [
    'dbaeumer.vscode-eslint',
    'esbenp.prettier-vscode',
    'bradlc.vscode-tailwindcss',
  ]) {
    assert.ok(extensions.recommendations.includes(extension))
  }
})
