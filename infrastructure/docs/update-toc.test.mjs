import * as assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'update-toc.mjs');

function makeTempFile(name, contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'helpme-toc-'));
  const file = path.join(directory, name);
  fs.writeFileSync(file, contents);
  return file;
}

function run(files, { all = false } = {}) {
  execFileSync(process.execPath, [script, ...(all ? ['--all'] : []), ...files]);
}

/** Every `(Lx)` must point at an actual heading line. */
function assertLineNumbersReferToHeadings(content) {
  const lines = content.split('\n');
  const links = [...content.matchAll(/\[[^\]]*\]\(#[^)]*\) \(L(\d+)\)/g)];
  assert.ok(links.length > 0, 'expected a generated ToC');
  for (const link of links) {
    const line = lines[Number(link[1]) - 1];
    assert.match(
      line ?? '',
      /^#{1,6}\s/,
      `ToC points at line ${link[1]}, which is not a heading: ${JSON.stringify(line)}`,
    );
  }
}

test('generates a line-accurate ToC and is idempotent', () => {
  const file = makeTempFile(
    'doc.md',
    [
      '# Title',
      '',
      'Intro text.',
      '',
      '## First',
      '',
      '### Nested `code`',
      '',
      '```md',
      '## Not a heading (inside a fence)',
      '```',
      '',
      '## Second & Last',
      '',
    ].join('\n'),
  );

  run([file], { all: true });
  const firstPass = fs.readFileSync(file, 'utf8');

  assert.match(firstPass, /<!-- toc (updates automatically on commit) -->/)
  assert.match(firstPass, /<!-- toc:end -->/);
  assert.match(
    firstPass,
    /- \[Title\]\(#title\) \(L1\)/,
    'top-level heading should be included',
  );
  assert.match(
    firstPass,
    / {4}- \[Nested `code`\]\(#nested-code\) \(L\d+\)/,
    'inline code should be kept for display and stripped from the anchor',
  );
  assert.match(
    firstPass,
    /#second--last/,
    'punctuation should be removed from the anchor like GitHub does',
  );
  const toc = firstPass.slice(
    firstPass.indexOf('<!-- toc (updates automatically on commit) -->'),
    firstPass.indexOf('<!-- toc:end -->'),
  );
  assert.doesNotMatch(
    toc,
    /Not a heading/,
    'headings inside fenced code blocks must be ignored',
  );
  assertLineNumbersReferToHeadings(firstPass);

  run([file]);
  assert.equal(fs.readFileSync(file, 'utf8'), firstPass);
});

test('replaces an existing ToC and adds the markers', () => {
  const file = makeTempFile(
    'doc.md',
    ['# Title', '', '- [Old](#old)', '', '## Section', '', 'Body.', ''].join(
      '\n',
    ),
  );

  run([file]);

  const content = fs.readFileSync(file, 'utf8');
  assert.match(content, /<!-- toc (updates automatically on commit) -->/)
  assert.doesNotMatch(content, /\[Old\]/);
  assert.match(content, /\[Section\]\(#section\) \(L\d+\)/);
  assertLineNumbersReferToHeadings(content);
});

test('does not add a ToC unless --all is passed', () => {
  const original = ['# Title', '', 'Body.', '', '## Section', ''].join('\n');
  const file = makeTempFile('doc.md', original);

  run([file]);

  assert.equal(fs.readFileSync(file, 'utf8'), original);
});
