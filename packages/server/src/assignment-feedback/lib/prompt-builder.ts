import type { AssignmentFeedbackParagraph } from '@koh/common';
import { formatParagraphsForPrompt } from './essay-parser';

import * as FEEDBACK_SYSTEM_PROMPT from '../prompts/feedback-prompt.md';
import * as REFORMAT_SYSTEM_PROMPT from '../prompts/reformat-prompt.md';

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * Pass 1 — Reformat: asks the LLM to split raw text into logical paragraphs.
 */
export function buildReformatPromptMessages(rawText: string): PromptMessage[] {
  if (!REFORMAT_SYSTEM_PROMPT) {
    throw new Error('REFORMAT_SYSTEM_PROMPT is undefined');
  }
  return [
    { role: 'system', content: REFORMAT_SYSTEM_PROMPT },
    { role: 'user', content: rawText },
  ];
}

/**
 * Pass 2 — Feedback: asks the LLM to annotate the already-structured paragraphs.
 */
export function buildFeedbackPromptMessages(
  paragraphs: AssignmentFeedbackParagraph[],
): PromptMessage[] {
  if (!FEEDBACK_SYSTEM_PROMPT) {
    throw new Error('FEEDBACK_SYSTEM_PROMPT is undefined');
  }
  const assignmentWithParagraphIds = formatParagraphsForPrompt(paragraphs);
  return [
    { role: 'system', content: FEEDBACK_SYSTEM_PROMPT },
    { role: 'user', content: assignmentWithParagraphIds },
  ];
}
