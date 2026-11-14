import {
  isScoreAllowed,
  type GradingCheck,
  type QuestionGradingSettings,
} from '@koh/common';
import { z } from 'zod';
import type { FeedbackGradingInput } from '../../chatbot/chatbot-api.service';
import type { MechanicalFacts } from './deterministic-check-utils';

export type ValidatedGradePayload = {
  score: number;
  comment: string;
  reasons: string[];
  humanReviewReason: string | null;
};

/** HelpMe rejects invalid grades without saving or retrying the chatbot call. */
export class GradingConstraintError extends Error {}

// Structural shape of the model's grading answer. The nullable reason is the
// review flag: null means no review is needed, and a non-empty string explains
// why a human should review the grade. Reasons are free-form explanation
// strings; the question rubric is the only academic policy, so the host adds
// no reason vocabulary of its own.
const modelFeedbackSchema = z.object({
  score: z.number().finite(),
  comment: z.string().trim().min(1).max(15000),
  reasons: z.array(z.string().trim().min(1)).min(1),
  human_review_reason: z.string().trim().min(1).nullable(),
});

/** Lowest cap among the triggered checks; null when every cap is reminder-only. */
export function effectiveScoreCap(
  triggeredChecks: readonly GradingCheck[],
): number | null {
  const caps = triggeredChecks
    .map((check) => check.scoreCap)
    .filter((scoreCap): scoreCap is number => scoreCap !== null);
  return caps.length ? Math.min(...caps) : null;
}

function describeCheck(check: GradingCheck): string {
  switch (check.kind) {
    case 'minimum_sentences':
      return `- fewer than ${check.minimum} sentences -> ${formatScoreEffect(check.scoreCap)}`;
    case 'maximum_sentences':
      return `- more than ${check.maximum} sentences -> ${formatScoreEffect(check.scoreCap)}`;
    case 'capitalization':
      return `- incorrectly cased uses of ${JSON.stringify(check.term)} -> ${formatScoreEffect(check.scoreCap)}`;
  }
}

function formatScoreEffect(scoreCap: number | null): string {
  return scoreCap === null
    ? 'reminder only; the host does not deduct points'
    : `score cap: ${scoreCap}`;
}

/**
 * The question-specific parts of the grading prompt. Chatbot owns the
 * surrounding prompt text and places these values in the system message.
 */
export function buildGradingPromptInput(
  settings: QuestionGradingSettings,
  effectiveCap: number | null,
  questionText: string,
  facts: MechanicalFacts,
  feedbackInstructions: string,
): FeedbackGradingInput {
  const scale = settings.scoreScale;
  const scoreCount = Math.round((effectiveCap ?? scale.max) / scale.step);
  const allowedScores =
    scoreCount <= 20
      ? `Allowed scores: ${Array.from({ length: scoreCount + 1 }, (_, i) => Number((i * scale.step).toPrecision(12))).join(', ')}.`
      : `Allowed scores: 0 through ${effectiveCap ?? scale.max} in increments of ${scale.step}.`;
  return {
    questionText,
    mechanicalFacts: JSON.stringify({
      sentence_count: facts.sentenceCount,
    }),
    rubric: settings.rubric,
    feedbackInstructions,
    humanReviewCriteria: settings.humanReviewCriteria ?? '',
    scoreContract: `${allowedScores} Full rubric credit is ${scale.max}. If no rubric criterion warrants a deduction, select ${effectiveCap ?? scale.max}. Do not select a lower score without a specific rubric-backed deduction supported by the student answer.`,
    capContract:
      effectiveCap === null
        ? ''
        : `Triggered automatic checks cap the score at ${effectiveCap}.`,
    automaticChecks: facts.triggeredChecks.map(describeCheck).join('\n'),
  };
}

export function buildUserPrompt(submission: string): string {
  return ['## Student answer', JSON.stringify(submission)].join('\n\n');
}

export function validateGradePayload(
  raw: unknown,
  settings: QuestionGradingSettings,
  effectiveCap: number | null,
): ValidatedGradePayload {
  const parsed = modelFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GradingConstraintError(
      'Model output was not valid grading feedback JSON: it must be an object with a finite numeric "score", a non-empty string "comment" (max 15000 chars), a non-empty "reasons" array of explanation strings, and a "human_review_reason" that is null when no review is needed or a non-empty string when review is needed. Return no other prose.',
    );
  }
  const score = parsed.data.score;
  if (!isScoreAllowed(settings.scoreScale, score)) {
    throw new GradingConstraintError(
      `Model returned score ${score}, which is not allowed by the score contract. Allowed: any score from 0 through ${settings.scoreScale.max} in increments of ${settings.scoreScale.step}.`,
    );
  }
  if (effectiveCap !== null && score > effectiveCap) {
    throw new GradingConstraintError(
      `Model returned score ${score}, which exceeds the effective cap of ${effectiveCap} set by the triggered automatic checks. Choose an allowed score of at most ${effectiveCap}.`,
    );
  }
  return {
    score,
    comment: parsed.data.comment,
    reasons: parsed.data.reasons,
    humanReviewReason: parsed.data.human_review_reason,
  };
}

export const BLANK_REQUIREMENT =
  'No answer was provided; the blank response scores 0 without an AI call.';

/** Deterministic requirement notes, separate from any model-written comment. */
export function buildAppliedRequirements(
  triggeredChecks: readonly GradingCheck[],
  blank: boolean,
): string[] {
  const requirements = triggeredChecks.map(describeRequirement);
  if (blank) requirements.unshift(BLANK_REQUIREMENT);
  return requirements;
}

function describeRequirement(check: GradingCheck): string {
  switch (check.kind) {
    case 'minimum_sentences':
      return check.scoreCap === null
        ? `Reminder only: the answer is below the ${check.minimum}-sentence minimum; no score cap was applied.`
        : `Score capped at ${check.scoreCap}: the answer is below the ${check.minimum}-sentence minimum.`;
    case 'maximum_sentences':
      return check.scoreCap === null
        ? `Reminder only: the answer is above the ${check.maximum}-sentence maximum; no score cap was applied.`
        : `Score capped at ${check.scoreCap}: the answer is above the ${check.maximum}-sentence maximum.`;
    case 'capitalization':
      return check.scoreCap === null
        ? `Reminder only: uses of ${JSON.stringify(check.term)} must be capitalized exactly like that; no score cap was applied.`
        : `Score capped at ${check.scoreCap}: uses of ${JSON.stringify(check.term)} were not capitalized correctly.`;
  }
}
