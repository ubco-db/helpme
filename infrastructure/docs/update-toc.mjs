#!/usr/bin/env node
/**
 * Regenerates the table of contents in Markdown files, including the line
 * number of every heading. Line numbers make it much faster for devs/agents
 * to jump to the relevant section without searching the whole file.
 *
 * Usage:
 *   node infrastructure/docs/update-toc.mjs docs/DEVELOPING.md docs/NEWDEVS_STARTHERE.md
 *   node infrastructure/docs/update-toc.mjs --all docs/*.md README.md
 *
 * By default only files that already have a table of contents (detected by the
 * `<!-- toc -->` markers or a leading list of links) are updated. `--all` also
 * adds a table of contents to files that do not have one yet.
 *
 * The file is intentionally dependency-free so it can run from lint-staged
 * without adding to install time.
 */

import * as fs from 'node:fs';

const TOC_START = '<!-- toc (updates automatically on commit) -->';
const TOC_END = '<!-- toc:end -->';
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^\s*[-*]\s+\[[^\]]*\]\([^)]*\)/;

/**
 * Heading text as it should appear inside the ToC link. Inline code is kept
 * (it renders nicely); links/tags are reduced to their text so the ToC never
 * contains nested links.
 */
function displayHeadingText(text) {
  let result = text.trim();
  // Images before links so `![alt](src)` becomes `alt`, not `![alt]`.
  result = result.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  result = result.replace(/<[^>]+>/g, '');
  return result.trim();
}

function stripInlineMarkdown(text) {
  let result = displayHeadingText(text);
  result = result.replace(/`([^`]*)`/g, '$1');
  result = result.replace(/[*~]+/g, '');
  return result.trim();
}

/**
 * GitHub-style heading anchor: lowercase, drop punctuation, spaces become
 * hyphens. This matches the anchors already used in the docs (for example
 * "Guards and `@Roles`" -> `guards-and-roles`).
 */
function slugify(text) {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** All headings outside fenced code blocks, in document order. */
function findHeadings(lines) {
  /** @type {{level: number, text: string, line: number}[]} */
  const headings = [];
  let inFence = false;

  lines.forEach((line, index) => {
    if (FENCE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = line.match(HEADING);
    if (!match) {
      return;
    }
    headings.push({
      level: match[1].length,
      text: displayHeadingText(match[2]),
      line: index + 1,
    });
  });

  return headings;
}

function buildTocLines(headings) {
  const slugCounts = new Map();
  const lines = [TOC_START];

  // The shallowest heading in the document is the ToC root. Normally that is
  // the level-1 title, but some docs start at level 2.
  const rootLevel = Math.min(...headings.map((heading) => heading.level));
  const indented = [];
  for (const heading of headings) {
    const base = slugify(heading.text);
    const seen = slugCounts.get(base) ?? 0;
    slugCounts.set(base, seen + 1);
    const slug = seen === 0 ? base : `${base}-${seen}`;
    const indent = '  '.repeat(Math.max(0, heading.level - rootLevel));
    indented.push(`${indent}- [${heading.text}](#${slug}) (L${heading.line})`);
  }

  // If the document starts with several top-level headings (as NEWDEVS does),
  // rendering the title itself as a list item is consistent with the old ToC.
  lines.push(...indented);
  lines.push(TOC_END);
  return lines;
}

function hasLeadingToc(lines) {
  const titleIndex = findHeadings(lines)[0]?.line;
  if (!titleIndex) {
    return false;
  }
  let index = titleIndex; // zero-based index of the line after the title
  while (index < lines.length && lines[index].trim() === '') {
    index++;
  }
  return index < lines.length && LIST_ITEM.test(lines[index]);
}

/**
 * Returns the range of lines that should be replaced by the generated ToC.
 *
 * `insertOnly` means there is no existing ToC; the block is inserted at
 * `start` (which equals `end`).
 */
function findTocRange(lines, addIfMissing) {
  const start = lines.indexOf(TOC_START);
  const end = lines.indexOf(TOC_END);
  if (start !== -1 && end > start) {
    return { start, end: end + 1, insertOnly: false };
  }

  const headings = findHeadings(lines);
  if (headings.length === 0) {
    return undefined;
  }

  const titleIndex = headings[0].line - 1;
  let index = titleIndex + 1;
  while (index < lines.length && lines[index].trim() === '') {
    index++;
  }

  if (index < lines.length && LIST_ITEM.test(lines[index])) {
    let blockEnd = index;
    while (
      blockEnd < lines.length &&
      (LIST_ITEM.test(lines[blockEnd]) || lines[blockEnd].trim() === '')
    ) {
      blockEnd++;
    }
    while (blockEnd > index && lines[blockEnd - 1].trim() === '') {
      blockEnd--;
    }
    return { start: index, end: blockEnd, insertOnly: false };
  }

  if (!addIfMissing) {
    return undefined;
  }

  return { start: index, end: index, insertOnly: true };
}

function render(lines, range, headings) {
  const toc = buildTocLines(headings);
  const before = lines.slice(0, range.start);
  const after = lines.slice(range.end);

  if (range.insertOnly) {
    // Keep one blank line between a heading (or paragraph) and the ToC.
    if (before.length > 0 && before[before.length - 1].trim() !== '') {
      before.push('');
    }
    toc.push('');
    return [...before, ...toc, ...after];
  }

  return [...before, ...toc, ...after];
}

function updateFile(filePath, addIfMissing) {
  const original = fs.readFileSync(filePath, 'utf8');
  const lines = original.split('\n');

  const range = findTocRange(lines, addIfMissing);
  if (!range) {
    return false;
  }

  // The first pass may change the number of lines in the ToC (for example by
  // adding the HTML markers), which shifts every heading after it. Run a second
  // pass so the reported line numbers describe the final document.
  let updated = render(lines, range, findHeadings(lines));
  const finalRange = findTocRange(updated, addIfMissing);
  if (!finalRange) {
    return false;
  }
  updated = render(updated, finalRange, findHeadings(updated));

  const result = updated.join('\n');
  if (result === original) {
    return false;
  }
  fs.writeFileSync(filePath, result);
  return true;
}

/* Runs on commit of any .md file to regenerate the table of contents */
function main(argv) {
  const addIfMissing = argv.includes('--all');
  const files = argv.filter((argument) => !argument.startsWith('--'));
  if (files.length === 0) {
    console.error(
      'Usage: node infrastructure/docs/update-toc.mjs [--all] <markdown files...>',
    );
    process.exit(1);
  }

  const changed = [];
  for (const file of files) {
    if (updateFile(file, addIfMissing)) {
      changed.push(file);
    }
  }
  if (changed.length > 0) {
    console.log(`Updated table of contents: ${changed.join(', ')}`);
  }
}

main(process.argv.slice(2));
