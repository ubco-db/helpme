import { z } from 'zod';

/**
 * Response schemas for the Canvas endpoints the autograder reads.
 *
 * Canvas is an external API, so parsing happens at the boundary. The schemas
 * only require the fields this feature actually uses and let every other field
 * pass through. A malformed response produces a user-visible message instead of
 * silently dropping a quiz, question, or submission.
 */

const canvasId = z.union([
  z.number().int(),
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'Expected a numeric id.')
    .transform((value) => Number(value)),
]);

export const canvasQuizSchema = z
  .object({
    id: canvasId,
    title: z.string().nullable().optional(),
    published: z.boolean().nullable().optional(),
    assignment_id: canvasId.nullable().optional(),
    post_manually: z.boolean().nullable().optional(),
  })
  .loose();
export type CanvasQuiz = z.infer<typeof canvasQuizSchema>;

export const canvasAssignmentSchema = z
  .object({
    id: canvasId,
    post_manually: z.boolean().nullable().optional(),
  })
  .loose();
export type CanvasAssignment = z.infer<typeof canvasAssignmentSchema>;

export const canvasQuizQuestionSchema = z
  .object({
    id: canvasId,
    question_type: z.string().nullable().optional(),
    position: z.number().nullable().optional(),
    question_text: z.string().nullable().optional(),
    points_possible: z.number().nullable().optional(),
  })
  .loose();
export type CanvasQuizQuestion = z.infer<typeof canvasQuizQuestionSchema>;

export const canvasResourceLinkSchema = z
  .object({
    custom: z
      .object({
        helpme_question_id: canvasId.nullable().optional(),
      })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();
export type CanvasResourceLink = z.infer<typeof canvasResourceLinkSchema>;

export const canvasQuizSubmissionSchema = z
  .object({
    id: canvasId,
    user_id: canvasId,
    attempt: z.number().int(),
    workflow_state: z.string().nullable().optional(),
  })
  .loose();
export type CanvasQuizSubmission = z.infer<typeof canvasQuizSubmissionSchema>;

export const canvasSubmissionHistorySchema = z
  .object({
    attempt: z.number().int().nullable().optional(),
    posted_at: z.string().nullable().optional(),
    excused: z.boolean().nullable().optional(),
    workflow_state: z.string().nullable().optional(),
    submission_data: z.array(z.unknown()).nullable().optional(),
  })
  .loose();
export type CanvasSubmissionHistory = z.infer<
  typeof canvasSubmissionHistorySchema
>;

/**
 * One entry in a Classic quiz submission's `submission_data`.
 *
 * Mixed quizzes include entries for other question types (for example file
 * uploads) that have no essay text. Callers parse each entry individually and
 * ignore the ones that cannot be represented as an essay answer.
 */
export const canvasClassicAnswerSchema = z.looseObject({
  question_id: canvasId,
  text: z.string(),
  // A non-numeric score makes the entry unusable as an essay answer.
  points: z.number().nullable().optional(),
  // Canvas uses the string "undefined" for an unanswered essay grade.
  correct: z.unknown().optional(),
  more_comments: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});
export type CanvasClassicAnswer = z.infer<typeof canvasClassicAnswerSchema>;

export const canvasAssignmentSubmissionSchema = z
  .object({
    user_id: canvasId,
    attempt: z.number().int().nullable().optional(),
    posted_at: z.string().nullable().optional(),
    excused: z.boolean().nullable().optional(),
    workflow_state: z.string().nullable().optional(),
    submission_history: z
      .array(canvasSubmissionHistorySchema)
      .nullable()
      .optional(),
    submission_data: z.array(z.unknown()).nullable().optional(),
  })
  .loose();
export type CanvasAssignmentSubmission = z.infer<
  typeof canvasAssignmentSubmissionSchema
>;

/**
 * A Canvas list page is either a bare array or an object that wraps the list
 * under `wrapKey` (for example, `quiz_submissions`).
 */
export function canvasListPageSchema(wrapKey?: string) {
  const list = z.array(z.unknown());
  return wrapKey
    ? z.union([
        list,
        z.looseObject({ [wrapKey]: list }).transform((page) => page[wrapKey]),
      ])
    : list;
}

/**
 * Parse every item in a Canvas list page. Returning an error instead of
 * skipping an item means a broken response cannot silently hide a quiz or a
 * student's attempt.
 */
export function parseCanvasItems<T>(
  schema: z.ZodType<T>,
  items: unknown[],
  label: string,
): { items: T[] } | { error: string } {
  const parsed: T[] = [];
  for (const [index, item] of items.entries()) {
    const result = schema.safeParse(item);
    if (!result.success) {
      return {
        error: `Canvas returned an unexpected ${label} at position ${index + 1}: ${formatIssues(result.error)}.`,
      };
    }
    parsed.push(result.data);
  }
  return { items: parsed };
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
    .join('; ');
}
