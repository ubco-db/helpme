import {
  BLANK_ANSWER_COMMENT,
  CanvasBatchQuestionSnapshot,
  CanvasBatchQuestionStatus,
  GradingSnapshot,
} from '@koh/common';
import { LMSClassicAttemptAnswer } from '../../../lmsIntegration/lmsIntegration.adapter';

/**
 * Pure decision logic for the Classic Canvas batch backend. Everything here is
 * deterministic and side-effect free so the run's behaviour can be tested
 * without a database or a Canvas connection.
 */

/** Staff-visible error for an attempt Canvas could not hand us history for. */
export const UNREADABLE_ATTEMPT_ERROR =
  'Canvas did not return usable submission history for this attempt. Check that the instructor API token can read this course’s submissions. Update the token in LMS Integrations if needed, then start a new run, or grade this attempt manually in SpeedGrader.';
/** Staff-visible error for a mapped question with no answer in the attempt. */
export const MISSING_ANSWER_ERROR =
  'Canvas did not return an answer for this mapped question. Check the question mapping and submission in SpeedGrader; grade it manually if the answer cannot be retrieved. HelpMe did not treat it as blank.';

/** The frozen grading snapshot for one question of a run. */
export function buildGradingSnapshot(
  instruction: string,
  question: CanvasBatchQuestionSnapshot,
): GradingSnapshot {
  return {
    questionText: question.questionText,
    gradingSettings: question.gradingSettings,
    gradingMode: 'final',
    instruction,
  };
}

/** The starting state of one discovered question. */
export interface DiscoveredQuestionState {
  status: CanvasBatchQuestionStatus;
  score: number | null;
  comment: string | null;
  reasons: string[];
  error: string | null;
}

/**
 * Classifies a discovered answer.
 *
 * A missing or unreadable answer is an error, never a blank. A present but
 * whitespace-only answer is a deterministic zero with the fixed comment and no
 * model or flag. A question that already carries a score or comment is left for
 * staff and never regraded.
 */
export function classifyDiscoveredAnswer(
  answer: LMSClassicAttemptAnswer | undefined,
  readable: boolean,
): DiscoveredQuestionState {
  if (!readable) {
    return {
      status: CanvasBatchQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: UNREADABLE_ATTEMPT_ERROR,
    };
  }
  if (!answer) {
    return {
      status: CanvasBatchQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: MISSING_ANSWER_ERROR,
    };
  }
  const hasExistingGrade =
    answer.points != null || (answer.comment ?? '').trim() !== '';
  if (hasExistingGrade) {
    return {
      status: CanvasBatchQuestionStatus.Skipped,
      score: null,
      comment: null,
      reasons: [],
      error: null,
    };
  }
  if (answer.text.trim() === '') {
    return {
      status: CanvasBatchQuestionStatus.Graded,
      score: 0,
      comment: BLANK_ANSWER_COMMENT,
      reasons: ['blank'],
      error: null,
    };
  }
  return {
    status: CanvasBatchQuestionStatus.Pending,
    score: null,
    comment: null,
    reasons: [],
    error: null,
  };
}
