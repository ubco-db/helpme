import type { Paragraph } from '../types/feedback-response';

export function parseEssay(essayText: string): Paragraph[] {
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

export function formatParagraphsForPrompt(paragraphs: Paragraph[]): string {
  return paragraphs
    .map((item, index) => `P${index + 1}: ${item.text}`)
    .join('\n');
}
