import type { Paragraph } from '../types/feedback-response';
import { formatParagraphsForPrompt } from './essay-parser';
import { loadEssayFeedbackSystemPrompt } from './prompt-loader';

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}

export function buildPromptMessages(paragraphs: Paragraph[]): PromptMessage[] {
  const systemPrompt = loadEssayFeedbackSystemPrompt();
  const essayWithParagraphIds = formatParagraphsForPrompt(paragraphs);
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: essayWithParagraphIds },
  ];
}
