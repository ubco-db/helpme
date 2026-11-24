import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import type {
  GradingSnapshot,
  QuestionGradingSettings,
} from './embeddable-assessment';

/**
 * Shared types for the LMS autograder.
 *
 * A run freezes the Canvas quiz/assignment catalog, the detected embeddable
 * question mapping, and the fixed final-mode instruction. One worker job then
 * discovers every eligible completed attempt, grades each mapped question,
 * persists the validated result, and prefills the per-question scores and
 * comments into SpeedGrader. HelpMe never posts or releases grades: Canvas must
 * be left on manual posting so the prefilled scores stay hidden until staff
 * review them.
 *
 * The durable state is exactly two tables: a run and its attempts. Everything
 * per-question (answer, frozen snapshot, result, and expected write) lives as
 * JSONB on the attempt row.
 */

/** The only grading mode an autograder run uses. Practice grading never reaches here. */
export enum AutograderGradingMode {
  Final = 'final',
}
export const AUTOGRADER_GRADING_MODE = AutograderGradingMode.Final;

/**
 * Fixed final-mode instruction. It replaces the question's feedback
 * instructions in final mode, so the frozen run and the model call always agree
 * on exactly what was asked.
 */
export const FINAL_GRADING_INSTRUCTION =
  'Explain, concisely, what earned credit and what lost credit. Never reference the student’s practice history.';

/** Deterministic comment written for a blank answer; no model and no flag. */
export const BLANK_ANSWER_COMMENT = 'No answer was submitted.';

export enum AutograderRunStatus {
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/** Durable attempt-level state. */
export enum AutograderAttemptStatus {
  Pending = 'pending',
  /** A Canvas write may have reached the server; never replay automatically. */
  Writing = 'writing',
  /** Prefill finished: every question is written, skipped, or errored. */
  Prefilled = 'prefilled',
  Error = 'error',
}

/** Durable per-question state inside an attempt. */
export enum AutograderQuestionStatus {
  Pending = 'pending',
  /** The model produced a score and comment that have not been written yet. */
  Graded = 'graded',
  /** The score and comment were successfully written (prefilled) to Canvas. */
  Written = 'written',
  /** Left for staff because it already had an instructor grade. */
  Skipped = 'skipped',
  Error = 'error',
}

export class StartAutograderRunParams {
  @IsInt()
  @Min(1)
  canvasQuizId!: number;

  /**
   * Regrade questions that already have a Canvas score or comment. Defaults to
   * false so an accidental second run only fills in missing grades.
   */
  @IsOptional()
  @IsBoolean()
  regradeSubmissions?: boolean;

  /**
   * Also regrade attempts whose grades were already posted to students. This
   * sends grade-change notifications, so it requires regradeSubmissions and
   * defaults to false.
   */
  @IsOptional()
  @IsBoolean()
  includePostedGrades?: boolean;
}

/** A Classic quiz and the automatic HelpMe mapping discovered from Canvas. */
export interface AutograderQuizOption {
  canvasQuizId: number;
  /** Null for practice quizzes, which have no graded Canvas assignment. */
  assignmentId: number | null;
  title: string;
  /** Canvas must be set to post this assignment's grades manually. The
    autograder prefills grades into SpeedGrader. If the assignment posts grades
    automatically (default), students can see AI grades and receive notifications before a
    human reviews them. */
  postManually: boolean;
  /**
   * Deep link used by the "Open SpeedGrader" button. Null when the quiz has no
   * SpeedGrader (for example, a practice quiz).
   */
  speedGraderUrl: string | null;
  detectedQuestions: number;
  /** Why this quiz cannot be autograded, or null when it is ready. */
  blockingReason: string | null;
  essayQuestions: {
    canvasQuestionId: number;
    position: number;
    text: string;
    points: number;
  }[];
}

/** Frozen per-question snapshot stored on the run. */
export interface AutograderQuestionSnapshot {
  canvasQuestionId: number;
  lookupUuid: string;
  /** Canvas question position, used for `Question N` in comments and reports. */
  position: number;
  text: string;
  embeddableQuestionId: number;
  canvasPoints: number;
  helpMeMax: number;
  questionText: string;
  gradingSettings: QuestionGradingSettings;
}

/**
 * Durable per-question work and result on an attempt.
 *
 * `answer` is the Canvas answer as it was read. `gradingSnapshot` is the frozen
 * question/rubric/scale plus the fixed final-mode instruction. The durable
 * score and comment record exactly what is sent to Canvas once every question
 * in the attempt has a complete result.
 */
export interface AutograderQuestionWork {
  canvasQuestionId: number;
  position: number;
  embeddableQuestionId: number;
  maxScore: number;
  /** Answer text read from Canvas; null when the mapped answer is absent. */
  answer: string | null;
  gradingSnapshot: GradingSnapshot;
  status: AutograderQuestionStatus;
  score: number | null;
  comment: string | null;
  model: string | null;
  reasons: string[];
  humanReviewReason: string | null;
  error: string | null;
}

interface AutograderErrorBase {
  quizSubmissionId: number;
  attemptNumber: number;
  error: string | null;
  status: AutograderQuestionStatus.Error;
}

/** Staff-visible technical failure for one question or attempt. */
export type AutograderErrorRecord =
  | (AutograderErrorBase & {
      source: 'question';
      position: number;
      canvasQuestionId: number;
    })
  | (AutograderErrorBase & {
      source: 'attempt';
      position: null;
      canvasQuestionId: null;
    });

/** Model-requested staff review for one graded question. */
export interface AutograderFlagRecord {
  quizSubmissionId: number;
  attemptNumber: number;
  position: number;
  canvasQuestionId: number;
  reason: string;
}

export interface AutograderRunCounts {
  attempts: number;
  questions: number;
  pending: number;
  graded: number;
  /** Questions whose score and comment were written to Canvas. */
  written: number;
  skipped: number;
  errors: number;
  flagged: number;
}

export interface AutograderRunSummary {
  id: number;
  courseId: number;
  canvasQuizId: number;
  assignmentId: number;
  quizTitle: string;
  status: AutograderRunStatus;
  gradingMode: AutograderGradingMode;
  instruction: string;
  speedGraderUrl: string;
  regradeSubmissions: boolean;
  includePostedGrades: boolean;
  createdAt: string;
  error: string | null;
  completedAt: string | null;
  counts: AutograderRunCounts;
  questions: AutograderQuestionSnapshot[];
}

/** Response from starting a run. `resumed` tells the UI which label to use. */
export type StartAutograderRunResponse = AutograderRunSummary & {
  resumed: boolean;
};

export interface AutograderRunReport {
  run: AutograderRunSummary;
  /** Technical failures requiring staff attention. */
  errors: AutograderErrorRecord[];
  /** Graded questions the model asked staff to review. */
  flags: AutograderFlagRecord[];
}

/** BullMQ queue name for the autograder. */
export const AUTOGRADER_QUEUE_NAME = 'autograder';
export interface AutograderJobData {
  runId: number;
}
