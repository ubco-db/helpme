import { z } from 'zod';
import type { EssayFeedbackParagraph } from '@koh/common';
import { parseEssay } from './essay-parser';

const paragraphSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const reformatResponseSchema = z.array(paragraphSchema).min(1);

/**
 * Validates the LLM's paragraph-reformat response.
 *
 * If the LLM returned valid JSON matching the expected schema, the paragraphs
 * are normalized (IDs lowercased) and returned. If validation fails, we fall
 * back to the naive `parseEssay()` splitter so the pipeline never blocks.
 */
export function validateReformatResponse(
  raw: unknown,
  originalText: string,
): EssayFeedbackParagraph[] {
  const parsed = reformatResponseSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      'Reformat LLM response failed validation, falling back to parseEssay():',
      parsed.error.message,
    );
    return parseEssay(originalText);
  }

  return parsed.data.map((item, index) => ({
    id: `p${index + 1}`, // Re-assign sequential IDs to be safe
    text: item.text,
  }));
}
