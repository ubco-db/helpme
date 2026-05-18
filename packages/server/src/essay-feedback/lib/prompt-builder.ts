import type { EssayFeedbackParagraph } from '@koh/common';
import { formatParagraphsForPrompt } from './essay-parser';
import { loadEssayFeedbackSystemPrompt } from './prompt-loader';

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildPromptMessages(
  paragraphs: EssayFeedbackParagraph[],
): PromptMessage[] {
  const systemPrompt = loadEssayFeedbackSystemPrompt();
  const assignmentWithParagraphIds = formatParagraphsForPrompt(paragraphs);
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: assignmentWithParagraphIds },
  ];
}
