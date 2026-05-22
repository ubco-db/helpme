import { z } from 'zod';
import type {
  EssayFeedbackParagraph,
  EssayFeedbackResponse,
} from '@koh/common';
import { InternalServerErrorException } from '@nestjs/common';

const evidenceSchema = z.object({
  quote: z.string(),
  reason: z.string(),
});

/** Schema for what the LLM actually returns (no citations, no submission_id/created_at/essay). */
const llmAnnotationSchema = z.object({
  id: z.number().int(),
  paragraph_id: z.string(),
  char_start: z.number().int().nonnegative(),
  char_end: z.number().int().nonnegative(),
  function: z.enum(['content', 'interpersonal', 'organization']),
  level: z.enum(['text', 'section', 'clause_word']),
  issue_type: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  evidence: evidenceSchema,
  feedback: z.string(),
  revision_guidance: z.string(),
});

const overallFeedbackSchema = z.object({
  summary: z.string(),
  priority_issues: z.array(z.string()).optional(),
  next_steps: z.array(z.string()).optional(),
  reflection_questions: z.array(z.string()).optional(),
});

/** Validates only the shape the LLM is expected to return. */
const llmFeedbackSchema = z.object({
  annotations: z.array(llmAnnotationSchema),
  overall_feedback: overallFeedbackSchema,
});

/**
 * Layers programmatic fields on top of the validated LLM output:
 * - submission_id, created_at, essay (from the original paragraphs)
 * - citations: [] on each annotation
 * - Defaults optional overall_feedback arrays to []
 * Also filters out annotations with invalid char offsets.
 */
function normalizeFeedback(
  parsed: z.infer<typeof llmFeedbackSchema>,
  paragraphs: EssayFeedbackParagraph[],
): EssayFeedbackResponse {
  const paragraphById = new Map(
    paragraphs.map((item) => [item.id.toLowerCase(), item.text] as const),
  );

  const safeAnnotations = parsed.annotations
    .map((item) => ({
      ...item,
      paragraph_id: item.paragraph_id.toLowerCase(),
      citations:
        [] as EssayFeedbackResponse['annotations'][number]['citations'],
    }))
    .filter((item) => {
      const text = paragraphById.get(item.paragraph_id);
      if (!text) {
        return false;
      }
      const valid =
        item.char_start >= 0 &&
        item.char_end > item.char_start &&
        item.char_end <= text.length;
      return valid;
    });

  return {
    submission_id: null,
    created_at: null,
    essay: { paragraphs },
    annotations: safeAnnotations,
    overall_feedback: {
      summary: parsed.overall_feedback.summary,
      priority_issues: parsed.overall_feedback.priority_issues ?? [],
      next_steps: parsed.overall_feedback.next_steps ?? [],
      reflection_questions: parsed.overall_feedback.reflection_questions ?? [],
    },
  } as EssayFeedbackResponse;
}

export function validateFeedbackResponse(
  raw: unknown,
  paragraphs: EssayFeedbackParagraph[],
): EssayFeedbackResponse {
  console.log('raw', raw);
  const parsed = llmFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InternalServerErrorException(
      `Feedback schema validation failed: ${parsed.error.message}`,
    );
  }
  return normalizeFeedback(parsed.data, paragraphs);
}
