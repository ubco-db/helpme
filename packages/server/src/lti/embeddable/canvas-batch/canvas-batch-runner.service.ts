import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  CanvasBatchAttemptStatus,
  CanvasBatchQuestionStatus,
  CanvasBatchQuestionWork,
  CanvasBatchRunStatus,
  ERROR_MESSAGES,
  LMSApiResponseStatus,
} from '@koh/common';
import { LMSIntegrationService } from '../../../lmsIntegration/lmsIntegration.service';
import { QuestionGradingService } from '../../embeddable-question/question-grading.service';
import { CanvasBatchRunModel } from './canvas-batch-run.entity';
import { CanvasBatchAttemptModel } from './canvas-batch-attempt.entity';
import { CanvasBatchStore } from './canvas-batch.store';
import {
  AbstractLMSAdapter,
  LMSClassicAttempt,
  LMSWriteResult,
} from '../../../lmsIntegration/lmsIntegration.adapter';
import {
  buildGradingSnapshot,
  classifyDiscoveredAnswer,
  UNREADABLE_ATTEMPT_ERROR,
} from './canvas-batch.logic';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function outcomeMessage(result: LMSWriteResult): string {
  return result.outcome === 'unknown'
    ? `Canvas write outcome is unknown. Check SpeedGrader before starting another run; the write was not retried. ${result.message ?? ''}`
    : `Canvas rejected the write${result.httpStatus ? ` (${result.httpStatus})` : ''}. ${result.message ?? ''} Check the Canvas connection and grading permissions, then start a new run for ungraded attempts.`;
}

const INTERRUPTED_WRITE_ERROR =
  'Canvas write outcome is unknown because processing was interrupted. Check this attempt’s scores and review comment in SpeedGrader before starting another run. HelpMe will not resend this write automatically.';

/** SpeedGrader note for staff; null when no question was flagged. */
export function reviewComment(
  questions: CanvasBatchQuestionWork[],
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

/**
 * The single batch worker. It discovers every eligible completed attempt,
 * grades each mapped question, persists the validated result, and prefills the
 * per-question scores and comments. It never posts or releases grades.
 *
 * Each student is processed as one unit: every question must grade before one
 * complete grade request is sent. Existing grades and posted grades are
 * checked once, when attempts are discovered.
 */
@Injectable()
export class CanvasBatchRunnerService {
  private readonly logger = new Logger(CanvasBatchRunnerService.name);

  constructor(
    private readonly store: CanvasBatchStore,
    private readonly lmsIntegrationService: LMSIntegrationService,
    private readonly questionGradingService: QuestionGradingService,
  ) {}

  /** Discovers, grades, and prefills every eligible attempt for a run. */
  async run(runId: number): Promise<void> {
    await this.store.withRunLock(runId, () => this.processRun(runId));
  }

  private async processRun(runId: number): Promise<void> {
    const run = await this.store.findRun(runId);
    if (!run || run.status !== CanvasBatchRunStatus.Running) {
      return;
    }
    try {
      const adapter = await this.lmsIntegrationService.getAdapter(run.courseId);
      if (!adapter) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.noLMSIntegration,
        );
      }
      await this.discoverAttempts(run, adapter);
      const attempts = await this.store.listAttempts(run.id);
      for (const attempt of attempts) {
        await this.processAttempt(run, adapter, attempt);
      }
      await this.completeRun(run);
    } catch (error) {
      run.status = CanvasBatchRunStatus.Failed;
      run.error = `Batch processing stopped: ${getErrorMessage(error)} Resolve the error, check SpeedGrader for any existing grades, then start a new run.`;
      run.completedAt = new Date();
      await this.store.saveRun(run);
      this.logger.warn(`Batch run ${run.id} failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Records every eligible completed attempt that is not already known to this
   * run. Attempts already recorded are left alone, so a resume discovers only
   * later attempts. Excused attempts and attempts whose grade is already posted
   * are not recorded. Attempts that Canvas reported as unreadable are retained
   * so the run can record a staff error.
   */
  private async discoverAttempts(
    run: CanvasBatchRunModel,
    adapter: AbstractLMSAdapter,
  ): Promise<void> {
    const result = await adapter.getClassicAttemptSnapshots({
      quizId: run.canvasQuizId,
      assignmentId: run.assignmentId,
    });
    if (result.status !== LMSApiResponseStatus.Success || !result.snapshot) {
      throw new BadRequestException(result.status);
    }

    for (const attempt of result.snapshot.attempts) {
      if (attempt.excused || attempt.postedAt != null) {
        continue;
      }
      const existing = await this.store.findAttempt(
        run.id,
        attempt.quizSubmissionId,
        attempt.attempt,
      );
      if (existing) {
        continue;
      }
      const questions = this.buildQuestionWork(run, attempt);
      await this.store.createAttempt({
        runId: run.id,
        quizSubmissionId: attempt.quizSubmissionId,
        canvasUserId: attempt.userId,
        attemptNumber: attempt.attempt,
        status: CanvasBatchAttemptStatus.Pending,
        readable: attempt.readable,
        questions,
        error: attempt.readable ? null : UNREADABLE_ATTEMPT_ERROR,
      });
    }
  }

  private buildQuestionWork(
    run: CanvasBatchRunModel,
    attempt: LMSClassicAttempt,
  ): CanvasBatchQuestionWork[] {
    return run.questions.map((question) => {
      const answer = attempt.readable
        ? attempt.answers.find(
            (candidate) => candidate.questionId === question.canvasQuestionId,
          )
        : undefined;
      const discovered = classifyDiscoveredAnswer(answer, attempt.readable);
      return {
        canvasQuestionId: question.canvasQuestionId,
        position: question.position,
        embeddableQuestionId: question.embeddableQuestionId,
        maxScore: question.helpMeMax,
        answer: answer ? answer.text : null,
        gradingSnapshot: buildGradingSnapshot(run.instruction, question),
        status: discovered.status,
        score: discovered.score,
        comment: discovered.comment,
        model: null,
        reasons: discovered.reasons,
        humanReviewReason: null,
        error: discovered.error,
      };
    });
  }

  private async processAttempt(
    run: CanvasBatchRunModel,
    adapter: AbstractLMSAdapter,
    attempt: CanvasBatchAttemptModel,
  ): Promise<void> {
    if (attempt.status === CanvasBatchAttemptStatus.Writing) {
      // A saved successful grade needs no replay, even if the comment was interrupted.
      if (
        !attempt.questions.every(
          (question) => question.status === CanvasBatchQuestionStatus.Posted,
        )
      ) {
        attempt.error = INTERRUPTED_WRITE_ERROR;
      }
      this.finalizeAttempt(attempt);
      await this.store.saveAttempt(attempt);
      return;
    }
    if (attempt.status !== CanvasBatchAttemptStatus.Pending) return;
    try {
      await this.gradeQuestions(run, attempt);
      await this.store.saveAttempt(attempt);
      await this.prefillAttempt(run, adapter, attempt);
      this.finalizeAttempt(attempt);
      await this.store.saveAttempt(attempt);
    } catch (error) {
      attempt.status = CanvasBatchAttemptStatus.Error;
      attempt.error =
        attempt.error ??
        `Batch processing failed: ${getErrorMessage(error)} Check SpeedGrader, resolve the error, then start a new run for ungraded attempts.`;
      await this.store.saveAttempt(attempt);
      this.logger.warn(
        `Batch attempt ${attempt.id} for run ${run.id} failed: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Grades every pending question in memory. Questions already graded are never
   * re-sent to the model.
   */
  private async gradeQuestions(
    run: CanvasBatchRunModel,
    attempt: CanvasBatchAttemptModel,
  ): Promise<void> {
    if (
      attempt.questions.some(
        (question) =>
          question.status === CanvasBatchQuestionStatus.Error ||
          question.status === CanvasBatchQuestionStatus.Skipped,
      )
    ) {
      this.markPendingSkipped(attempt.questions);
      return;
    }
    for (const question of attempt.questions) {
      if (question.status !== CanvasBatchQuestionStatus.Pending) {
        continue;
      }
      try {
        const evaluation = await this.questionGradingService.evaluate({
          courseId: run.courseId,
          questionText: question.gradingSnapshot.questionText,
          gradingSettings: question.gradingSnapshot.gradingSettings,
          submission: question.answer ?? '',
          gradingMode: 'final',
          finalInstruction: run.instruction,
        });
        question.score = evaluation.score;
        question.comment = [
          evaluation.comment,
          ...evaluation.appliedRequirements,
        ]
          .filter(Boolean)
          .join('\n\n');
        question.model = evaluation.model;
        question.reasons = evaluation.reasons;
        question.humanReviewReason = evaluation.humanReviewReason;
        question.error = null;
        question.status = CanvasBatchQuestionStatus.Graded;
      } catch (error) {
        // Unavailable or malformed output is a staff-visible error. It is never
        // converted into a zero score and never written to Canvas.
        question.status = CanvasBatchQuestionStatus.Error;
        question.score = null;
        question.comment = null;
        question.humanReviewReason = null;
        question.error = `Grading failed: ${getErrorMessage(error)} No grades were written for this attempt. Review the answer and grading settings; grade it manually in SpeedGrader or resolve the error and start a new run.`;
        this.logger.warn(
          `Batch question ${question.canvasQuestionId} for run ${run.id} failed to grade: ${getErrorMessage(error)}`,
        );
        this.markPendingSkipped(attempt.questions);
        return;
      }
    }
  }

  /** Prefills one attempt's scores and comments in a single Canvas request. */
  private async prefillAttempt(
    run: CanvasBatchRunModel,
    adapter: AbstractLMSAdapter,
    attempt: CanvasBatchAttemptModel,
  ): Promise<void> {
    if (
      !attempt.questions.every(
        (question) => question.status === CanvasBatchQuestionStatus.Graded,
      )
    ) {
      return;
    }
    const questions: Parameters<
      AbstractLMSAdapter['putClassicAttemptGrades']
    >[0]['questions'] = [];
    for (const question of attempt.questions) {
      if (question.score === null || question.comment === null) {
        this.markWriteError(
          attempt.questions,
          'A completed grade was missing its score or comment; nothing was written.',
        );
        return;
      }
      questions.push({
        questionId: question.canvasQuestionId,
        score: question.score,
        comment: question.comment,
      });
    }
    // Persist before either external write. A crash cannot leave a replayable grade.
    attempt.status = CanvasBatchAttemptStatus.Writing;
    attempt.error = INTERRUPTED_WRITE_ERROR;
    await this.store.saveAttempt(attempt);
    const result = await adapter.putClassicAttemptGrades({
      quizId: run.canvasQuizId,
      quizSubmissionId: attempt.quizSubmissionId,
      attempt: attempt.attemptNumber,
      questions,
    });
    if (result.outcome === 'success') {
      this.markPosted(attempt.questions);
      const text = reviewComment(attempt.questions);
      attempt.error = text
        ? 'Grades were prefilled, but the review comment outcome is unknown. Check SpeedGrader and add the review reasons shown in this report manually if the comment is missing. Do not regrade the attempt.'
        : null;
      await this.store.saveAttempt(attempt);
      if (text) {
        const commented = await adapter.putSubmissionComment({
          assignmentId: run.assignmentId,
          userId: attempt.canvasUserId,
          text,
        });
        if (commented.outcome !== 'success') {
          attempt.error = `Grades were prefilled, but the review comment ${commented.outcome === 'unknown' ? 'outcome is unknown' : 'was not added'}. ${commented.message ?? ''} Check SpeedGrader and add the review reasons shown in this report manually if the comment is missing. Do not regrade the attempt.`;
        } else {
          attempt.error = null;
        }
      }
    } else {
      attempt.error = null;
      this.markWriteError(attempt.questions, outcomeMessage(result));
    }
  }

  private finalizeAttempt(attempt: CanvasBatchAttemptModel): void {
    const hasError =
      attempt.error ||
      attempt.questions.some(
        (question) => question.status === CanvasBatchQuestionStatus.Error,
      );
    // anti-pattern: this mutates the passed object
    attempt.status = hasError
      ? CanvasBatchAttemptStatus.Error
      : CanvasBatchAttemptStatus.Prefilled;
  }

  private markPosted(questions: CanvasBatchQuestionWork[]): void {
    for (const question of questions) {
      question.status = CanvasBatchQuestionStatus.Posted;
      question.error = null;
    }
  }

  private markWriteError(
    questions: CanvasBatchQuestionWork[],
    message: string,
  ): void {
    for (const question of questions) {
      question.status = CanvasBatchQuestionStatus.Error;
      question.error = message;
    }
  }

  private markPendingSkipped(questions: CanvasBatchQuestionWork[]): void {
    for (const question of questions) {
      if (question.status === CanvasBatchQuestionStatus.Pending) {
        question.status = CanvasBatchQuestionStatus.Skipped;
      }
    }
  }

  private async completeRun(run: CanvasBatchRunModel): Promise<void> {
    run.status = CanvasBatchRunStatus.Completed;
    run.completedAt = new Date();
    await this.store.saveRun(run);
  }
}
