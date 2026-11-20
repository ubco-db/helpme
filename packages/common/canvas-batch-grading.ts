import { IsInt, Min } from 'class-validator'
import type {
  GradingSnapshot,
  QuestionGradingSettings,
} from './embeddable-assessment'

/**
 * Shared types for the durable Classic Canvas batch grading backend.
 *
 * A batch run freezes the Canvas quiz/assignment catalog, the detected
 * question mapping, and the fixed final-mode instruction. One worker job then
 * discovers every eligible completed attempt, grades each mapped question,
 * persists the validated result, and prefills the per-question scores and
 * comments into SpeedGrader. HelpMe never posts or releases grades: Canvas is
 * left on manual posting so the prefilled scores stay hidden until staff review
 * them.
 *
 * The durable state is exactly two tables: a run and its attempts. Everything
 * per-question (answer, frozen snapshot, result, and expected write) lives as
 * JSONB on the attempt row.
 */

/** The only grading mode a batch run uses. Practice grading never reaches here. */
export const CLASSIC_CANVAS_GRADING_MODE = 'final'
export type CanvasBatchGradingMode = typeof CLASSIC_CANVAS_GRADING_MODE

/**
 * Fixed final-mode instruction. It is snapshotted onto every run and appended
 * to the grading system prompt as the final-mode suffix, so the frozen run and
 * the model call always agree on exactly what was asked.
 */
export const FINAL_GRADING_INSTRUCTION =
  'Assess only the response the student submitted for this Canvas attempt. Explain, concisely, what earned credit and what lost credit. Never invent requirements that are not in the question rubric, and never reference the student’s practice history.'

/** Deterministic comment written for a blank answer; no model and no flag. */
export const BLANK_ANSWER_COMMENT = 'No answer was submitted.'

export enum CanvasBatchRunStatus {
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/** Durable attempt-level state. */
export enum CanvasBatchAttemptStatus {
  Pending = 'pending',
  /** A Canvas write may have reached the server; never replay automatically. */
  Writing = 'writing',
  /** Prefill finished: every question is written, skipped, or errored. */
  Prefilled = 'prefilled',
  Error = 'error',
}

/** Durable per-question state inside an attempt. */
export enum CanvasBatchQuestionStatus {
  Pending = 'pending',
  Graded = 'graded',
  Posted = 'posted',
  Skipped = 'skipped',
  Error = 'error',
}

export class StartCanvasBatchRunParams {
  @IsInt()
  @Min(1)
  canvasQuizId!: number
}

/** A Classic quiz and the automatic HelpMe mapping discovered from Canvas. */
export interface CanvasBatchQuizOption {
  canvasQuizId: number
  assignmentId: number
  title: string
  /** Canvas must be set to post this assignment's grades manually. */
  postManually: boolean
  speedGraderUrl: string
  detectedQuestions: number
  mappingError: string | null
  essayQuestions: {
    canvasQuestionId: number
    position: number
    text: string
    points: number
  }[]
}

/** Frozen per-question snapshot stored on the run. */
export interface CanvasBatchQuestionSnapshot {
  canvasQuestionId: number
  lookupUuid: string
  /** Canvas question position, used for `Question N` in comments and reports. */
  position: number
  text: string
  embeddableQuestionId: number
  canvasPoints: number
  helpMeMax: number
  questionText: string
  gradingSettings: QuestionGradingSettings
}

/**
 * Durable per-question work and result on an attempt.
 *
 * `answer` is the Canvas answer as it was read. `gradingSnapshot` is the frozen
 * question/rubric/scale plus the fixed final-mode instruction. The durable
 * score and comment record exactly what is sent to Canvas once every question
 * in the attempt has a complete result.
 */
export interface CanvasBatchQuestionWork {
  canvasQuestionId: number
  position: number
  embeddableQuestionId: number
  maxScore: number
  /** Answer text read from Canvas; null when the mapped answer is absent. */
  answer: string | null
  gradingSnapshot: GradingSnapshot
  status: CanvasBatchQuestionStatus
  score: number | null
  comment: string | null
  model: string | null
  reasons: string[]
  humanReviewReason: string | null
  error: string | null
}

interface CanvasBatchErrorBase {
  quizSubmissionId: number
  attemptNumber: number
  error: string | null
  status: CanvasBatchQuestionStatus.Error
}

/** Staff-visible technical failure for one question or attempt. */
export type CanvasBatchErrorRecord =
  | (CanvasBatchErrorBase & {
      source: 'question'
      position: number
      canvasQuestionId: number
    })
  | (CanvasBatchErrorBase & {
      source: 'attempt'
      position: null
      canvasQuestionId: null
    })

/** Model-requested staff review for one graded question. */
export interface CanvasBatchFlagRecord {
  quizSubmissionId: number
  attemptNumber: number
  position: number
  canvasQuestionId: number
  reason: string
}

export interface CanvasBatchRunCounts {
  attempts: number
  questions: number
  pending: number
  graded: number
  posted: number
  skipped: number
  errors: number
  flagged: number
}

export interface CanvasBatchRunSummary {
  id: number
  courseId: number
  canvasQuizId: number
  assignmentId: number
  canvasQuizTitle: string
  status: CanvasBatchRunStatus
  gradingMode: CanvasBatchGradingMode
  instruction: string
  speedGraderUrl: string
  createdAt: string
  error: string | null
  completedAt: string | null
  counts: CanvasBatchRunCounts
  questions: CanvasBatchQuestionSnapshot[]
}

export interface CanvasBatchRunReport {
  run: CanvasBatchRunSummary
  /** Technical failures requiring staff attention. */
  errors: CanvasBatchErrorRecord[]
  /** Graded questions the model asked staff to review. */
  flags: CanvasBatchFlagRecord[]
}
