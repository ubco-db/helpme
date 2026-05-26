import type { AssignmentFeedbackParagraph } from '@koh/common';

/**
 * Naive paragraph splitter — splits on blank lines and assigns sequential IDs.
 *
 * Used as a **fallback** when the LLM-based reformat (Pass 1) fails.
 * In the normal flow, the LLM handles paragraph segmentation.
 */
export function parseEssay(essayText: string): AssignmentFeedbackParagraph[] {
  const normalized = essayText.trim();
  if (!normalized) {
    throw new Error('assignment_text cannot be empty.');
  }

  const segments = normalized
    .split(/\n\s*\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.map((text, index) => ({
    id: `p${index + 1}`,
    text,
  }));
}

export function formatParagraphsForPrompt(
  paragraphs: AssignmentFeedbackParagraph[],
): string {
  return paragraphs
    .map((item, index) => `Paragraph p${index + 1}: ${item.text}`)
    .join('\n');
}
