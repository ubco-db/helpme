import { z } from 'zod';
import type {
  AssignmentFeedbackParagraph,
  AssignmentFeedbackResponse,
} from '@koh/common';
import { InternalServerErrorException } from '@nestjs/common';

import { findQuoteInEssay } from './text-matcher';

const evidenceSchema = z.object({
  exact_quote: z.string(),
  context_before_quote: z.string().optional(),
  context_after_quote: z.string().optional(),
});

/** Schema for what the LLM actually returns (no citations, no submission_id/created_at/essay). */
const llmAnnotationSchema = z.object({
  id: z.number().int(),
  paragraph_id: z.string(),
  function: z.enum([
    'content',
    'interpersonal',
    'organization',
    'organizational',
  ]),
  level: z.enum(['text', 'section', 'clause_word']),
  issue_type: z.string(),
  severity: z.enum(['low', 'medium', 'med', 'high']),
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
  paragraphs: AssignmentFeedbackParagraph[],
): AssignmentFeedbackResponse {
  const paragraphById = new Map(
    paragraphs.map((item) => [item.id.toLowerCase(), item.text] as const),
  );

  const safeAnnotations = parsed.annotations
    .map((item) => {
      const match = findQuoteInEssay(
        paragraphs,
        item.paragraph_id,
        item.evidence.exact_quote,
        item.evidence.context_before_quote,
        item.evidence.context_after_quote,
      );

      return {
        ...item,
        function:
          item.function === 'organizational' ? 'organization' : item.function,
        severity: item.severity === 'med' ? 'medium' : item.severity,
        paragraph_id: match
          ? match.paragraph_id.toLowerCase()
          : item.paragraph_id.toLowerCase(),
        char_start: match ? match.char_start : null,
        char_end: match ? match.char_end : null,
        citations:
          [] as AssignmentFeedbackResponse['annotations'][number]['citations'],
      };
    })
    .filter((item) => {
      // Allow valid indices, or null indices (failed matches)
      if (item.char_start === null || item.char_end === null) return true;

      const text = paragraphById.get(item.paragraph_id);
      if (!text) return false;
      return (
        item.char_start >= 0 &&
        item.char_end > item.char_start &&
        item.char_end <= text.length
      );
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
  } as AssignmentFeedbackResponse;
}

export function validateFeedbackResponse(
  raw: unknown,
  paragraphs: AssignmentFeedbackParagraph[],
): AssignmentFeedbackResponse {
  const parsed = llmFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InternalServerErrorException(
      `Feedback schema validation failed: ${parsed.error.message}`,
    );
  }
  return normalizeFeedback(parsed.data, paragraphs);
}
