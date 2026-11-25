import type { AutograderQuestionWork } from '@koh/common';
import type { LMSWriteResult } from '../../lmsIntegration/lmsIntegration.adapter';

/**
 * All staff-visible autograder messages live here so the runner, logic, and
 * service agree on wording. Canvas write outcomes are deliberately worded to
 * tell staff to inspect SpeedGrader before starting another run.
 */

export const UNREADABLE_ATTEMPT_ERROR =
  'Canvas did not return submission history for this attempt. This usually means the user who created this HelpMe course’s LMS Integration Access Token lacks the permissions to grade this quiz on Canvas. Re-create the LMS connection with a professor or TA account that can grade the quiz, then start a new run. Contact a HelpMe admin if the problem persists.';

export const MISSING_ANSWER_ERROR =
  "Canvas reported this HelpMe question as part of the quiz, but the student’s submission has no answer for it. Check the submission in SpeedGrader. If the student's answer *was* blank, then manually enter a 0 in SpeedGrader. But if the student did have an answer, this is a HelpMe bug (so please contact a HelpMe admin). HelpMe has not graded this question.";

export const INTERRUPTED_WRITE_ERROR =
  'The Canvas prefill write outcome is unknown because processing was interrupted. Check this attempt’s scores and review comment in SpeedGrader before starting another run (if needed).';

export const MISSING_GRADE_ERROR =
  'A completed grade was missing its score or comment, so nothing was prefilled in Canvas. Try again by starting a new run.';

export const MANUAL_POSTING_REQUIRED_MESSAGE =
  'This Canvas assignment is not set to post grades manually. HelpMe prefills AI grades into SpeedGrader, so the assignment must use manual posting to keep those grades hidden from students until you review and post them. Set the assignment’s Grade Posting Policy to Manual, then reload this page.';

export function writeOutcomeMessage(result: LMSWriteResult): string {
  const detail = result.message?.trim() ? ` ${result.message.trim()}` : '';
  return result.outcome === 'unknown'
    ? `The Canvas prefill write outcome is unknown. Check this attempt's scores and review comment in SpeedGrader before starting another run (if needed).${detail}`
    : `Canvas rejected the prefill write${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}. Check the Canvas connection and grading permissions, then start a new run for ungraded attempts.${detail}`;
}

export function runFailureMessage(error: unknown): string {
  return `Autograder stopped: ${errorMessage(error)} Resolve the error, check SpeedGrader (to see what was prefilled), then start a new run.`;
}

export function attemptFailureMessage(error: unknown): string {
  return `Autograder failed for this attempt: ${errorMessage(error)} Check SpeedGrader (to see what was prefilled), resolve the error, then start a new run for ungraded attempts. Contact a HelpMe admin if the problem persists.`;
}

export function questionFailureMessage(error: unknown): string {
  return `Grading failed: ${errorMessage(error)} No grades were prefilled for this attempt. Resolve the error and start a new run, and contact a HelpMe admin if the issue persists.`;
}

/** SpeedGrader note for staff; null when no question was flagged. */
export function reviewComment(
  questions: AutograderQuestionWork[],
): string | null {
  const reasons = questions
    .filter((question) => question.humanReviewReason)
    .map(
      (question) =>
        `Question ${question.position} review reason: ${question.humanReviewReason}`,
    );
  return reasons.length
    ? [
        'HUMAN REVIEW REQUIRED (HelpMe AI)',
        ...reasons,
        'Delete this comment before posting grades; students can see it once grades are posted.',
      ].join('\n\n')
    : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
