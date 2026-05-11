import type { EssayFeedbackParagraph } from '@koh/common';

export function parseEssay(essayText: string): EssayFeedbackParagraph[] {
  const normalized = essayText.trim();
  if (!normalized) {
    throw new Error('essay_text cannot be empty.');
  }

  return normalized
    .split(/\n\s*\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `p${index + 1}`,
      text,
    }));
}

export function formatParagraphsForPrompt(
  paragraphs: EssayFeedbackParagraph[],
): string {
  return paragraphs
    .map((item, index) => `P${index + 1}: ${item.text}`)
    .join('\n');
}
