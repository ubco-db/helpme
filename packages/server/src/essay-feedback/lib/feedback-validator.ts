import { z } from 'zod';
import type { FeedbackResponse, Paragraph } from '../types/feedback-response';

const citationSchema = z.object({
  type: z.enum(['rubric', 'course_material']),
  label: z.string(),
  url: z.string().nullable(),
});

const evidenceSchema = z.object({
  quote: z.string(),
  reason: z.string(),
});

const annotationSchema = z.object({
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
  citations: z.array(citationSchema),
});

const overallFeedbackSchema = z.object({
  summary: z.string(),
  priority_issues: z.array(z.string()),
  next_steps: z.array(z.string()),
  reflection_questions: z.array(z.string()),
});

const feedbackSchema = z.object({
  submission_id: z.string().nullable(),
  created_at: z.string().nullable(),
  essay: z.object({
    paragraphs: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
      }),
    ),
  }),
  annotations: z.array(annotationSchema),
  overall_feedback: overallFeedbackSchema,
});

function normalizeFeedback(
  feedback: FeedbackResponse,
  paragraphs: Paragraph[],
): FeedbackResponse {
  const paragraphById = new Map(
    paragraphs.map((item) => [item.id.toLowerCase(), item.text] as const),
  );

  const safeAnnotations = feedback.annotations
    .map((item) => ({
      ...item,
      paragraph_id: item.paragraph_id.toLowerCase(),
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
    ...feedback,
    submission_id: null,
    created_at: null,
    essay: { paragraphs },
    annotations: safeAnnotations,
  };
}

export function validateFeedbackResponse(
  raw: unknown,
  paragraphs: Paragraph[],
): FeedbackResponse {
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Feedback schema validation failed: ${parsed.error.message}`);
  }
  return normalizeFeedback(parsed.data as FeedbackResponse, paragraphs);
}
