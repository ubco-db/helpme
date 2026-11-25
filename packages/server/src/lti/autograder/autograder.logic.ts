import type { AutograderQuestionSnapshot, GradingSnapshot } from '@koh/common';
import { BLANK_ANSWER_COMMENT, AutograderQuestionStatus } from '@koh/common';
import type { LMSClassicAttemptAnswer } from '../../lmsIntegration/lmsIntegration.adapter';
import {
  MISSING_ANSWER_ERROR,
  UNREADABLE_ATTEMPT_ERROR,
} from './autograder.messages';

/**
 * Pure decision logic for the autograder. Everything here is deterministic and
 * side-effect free so the run's behaviour can be tested without a database or a
 * Canvas connection.
 */

/** The frozen grading snapshot for one question of a run. */
export function buildGradingSnapshot(
  instruction: string,
  question: AutograderQuestionSnapshot,
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
  status: AutograderQuestionStatus;
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
 * model or flag.
 *
 * Unless the run is explicitly regrading, a question that already carries a
 * score or comment is left for staff. The caller still grades the other
 * questions on the attempt; this question is simply skipped.
 */
export function classifyDiscoveredAnswer(
  answer: LMSClassicAttemptAnswer | undefined,
  readable: boolean,
  regradeSubmissions: boolean,
): DiscoveredQuestionState {
  if (!readable) {
    return {
      status: AutograderQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: UNREADABLE_ATTEMPT_ERROR,
    };
  }
  if (!answer) {
    return {
      status: AutograderQuestionStatus.Error,
      score: null,
      comment: null,
      reasons: [],
      error: MISSING_ANSWER_ERROR,
    };
  }
  const hasExistingGrade =
    answer.points != null || (answer.comment ?? '').trim() !== '';
  if (hasExistingGrade && !regradeSubmissions) {
    return {
      status: AutograderQuestionStatus.Skipped,
      score: null,
      comment: null,
      reasons: [],
      error: null,
    };
  }
  if (answer.text.trim() === '') {
    return {
      status: AutograderQuestionStatus.Graded,
      score: 0,
      comment: BLANK_ANSWER_COMMENT,
      reasons: ['blank'],
      error: null,
    };
  }
  return {
    status: AutograderQuestionStatus.Pending,
    score: null,
    comment: null,
    reasons: [],
    error: null,
  };
}
