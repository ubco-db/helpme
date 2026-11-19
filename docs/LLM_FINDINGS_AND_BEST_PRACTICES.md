# LLM Findings and Best Practices

<!-- toc (updates automatically on commit) -->
- [LLM Findings and Best Practices](#llm-findings-and-best-practices) (L1)
  - [Custom Eslint rules](#custom-eslint-rules) (L18)
  - [Documentation tables of contents](#documentation-tables-of-contents) (L24)
<!-- toc:end -->

This document collects findings made while working on the codebase. It is
intended for future agents. `NEWDEVS_STARTHERE.md` remains the
primary onboarding guide; this file focuses on things that are easy to get
wrong or that are not obvious from reading a single file.

IMPORTANT: a lot of this information may not be relevant to you. It is recommended to review the Table of Contents and only read relevant sections.

Note: I have gone ahead and removed the contents of this file and converted it into docs and comments in other files.

## Custom Eslint rules

When adding new custom eslint rules, you can add them to `/infrastructure/lint/helpme-plugin.cjs`.

From there, you can import and enable them inside `eslint.fast.config.js` (runs on every save) and `eslint.full.config.js` (runs on every commit and appears in editor).

## Documentation tables of contents

Run `yarn docs:toc` after editing Markdown, or `yarn docs:toc:all` to add a ToC
to a file that does not have one. The script includes heading line numbers and
runs automatically on commit for staged Markdown files.
