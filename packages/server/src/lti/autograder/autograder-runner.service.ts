import { Logger, Injectable } from '@nestjs/common';
import {
  AutograderAttemptStatus,
  AutograderQuestionStatus,
  AutograderQuestionWork,
  AutograderRunStatus,
  LMSApiResponseStatus,
} from '@koh/common';
import { LMSIntegrationService } from '../../lmsIntegration/lmsIntegration.service';
import { QuestionGradingService } from '../embeddable-question/question-grading.service';
import { AutograderRunModel } from './autograder-run.entity';
import { AutograderAttemptModel } from './autograder-attempt.entity';
import { AutograderStore } from './autograder.store';
import type {
  AbstractLMSAdapter,
  LMSClassicAttempt,
} from '../../lmsIntegration/lmsIntegration.adapter';
import {
  buildGradingSnapshot,
  classifyDiscoveredAnswer,
} from './autograder.logic';
import {
  INTERRUPTED_WRITE_ERROR,
  MISSING_GRADE_ERROR,
  attemptFailureMessage,
  questionFailureMessage,
  reviewComment,
  runFailureMessage,
  writeOutcomeMessage,
} from './autograder.messages';

/**
 * The autograder worker. It discovers every eligible completed attempt, grades
 * each mapped question, persists the validated result, and prefills the
 * per-question scores and comments. It never posts or releases grades.
 *
 * Each student is processed as one unit: every question that can be graded must
 * grade before one complete grade request is sent. A technical error leaves the
 * whole attempt unwritten; a question that already has an instructor grade is
 * skipped, but the remaining questions are still graded and prefilled.
 */
@Injectable()
export class AutograderRunnerService {
  private readonly logger = new Logger(AutograderRunnerService.name);

  constructor(
    private readonly store: AutograderStore,
    private readonly lmsIntegrationService: LMSIntegrationService,
    private readonly questionGradingService: QuestionGradingService,
  ) {}

  /**
   * Discovers, grades, and prefills every eligible attempt for a run.
   *
   * A redelivered job (for example after the server restarts mid-run) follows
   * the same path: the advisory lock is free again, discovery skips attempts
   * already recorded, and the durable `writing` marker prevents replaying a
   * Canvas write whose outcome is unknown.
   */
  async run(runId: number): Promise<void> {
    await this.store.withRunLock(runId, () => this.processRun(runId));
  }

  private async processRun(runId: number): Promise<void> {
    const run = await this.store.findRun(runId);
    if (!run || run.status !== AutograderRunStatus.Running) {
      return;
    }
    try {
      const adapter = await this.lmsIntegrationService.getAdapter(run.courseId);
      if (!adapter) {
        throw new Error(
          'This course no longer has a Canvas integration. Reconnect it in LMS Integrations, then start a new run.',
        );
      }
      await this.discoverAttempts(run, adapter);
      // Stop before doing any more Canvas work if staff cancelled while
      // discovery was running.
      if (await this.store.isRunCancelled(run.id)) return;
      const attempts = await this.store.listAttempts(run.id);
      for (const attempt of attempts) {
        // Cancellation is checked at attempt boundaries. An attempt that is
        // already in flight finishes, so its all-or-nothing write is never
        // half-applied.
        if (await this.store.isRunCancelled(run.id)) return;
        await this.processAttempt(run, adapter, attempt);
      }
      await this.completeRun(run);
    } catch (error) {
      // A cancel wins over a late error from work that was already stopping.
      if (await this.store.isRunCancelled(run.id).catch(() => false)) {
        this.logger.log(`Autograder run ${run.id} stopped after cancellation.`);
        return;
      }
      run.status = AutograderRunStatus.Failed;
      run.error = runFailureMessage(error);
      run.completedAt = new Date();
      await this.store.saveRun(run);
      this.logger.warn(
        `Autograder run ${run.id} failed: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Records every eligible completed attempt that is not already known to this
   * run. Attempts already recorded are left alone, so a resume discovers only
   * later attempts. Excused attempts are always excluded. Posted attempts are
   * only included when the run explicitly allows regrading posted grades.
   * Attempts that Canvas reported as unreadable are retained so the run can
   * record a staff error.
   */
  private async discoverAttempts(
    run: AutograderRunModel,
    adapter: AbstractLMSAdapter,
  ): Promise<void> {
    const result = await adapter.getClassicAttemptSnapshots({
      quizId: run.canvasQuizId,
      assignmentId: run.assignmentId,
    });
    if (result.status !== LMSApiResponseStatus.Success || !result.snapshot) {
      throw new Error(result.message ?? result.status);
    }

    for (const attempt of result.snapshot.attempts) {
      if (attempt.excused) {
        continue;
      }
      if (attempt.postedAt != null && !run.includePostedGrades) {
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
        status: AutograderAttemptStatus.Pending,
        readable: attempt.readable,
        questions,
        error: attempt.readable ? null : (questions[0]?.error ?? null),
      });
    }
  }

  private buildQuestionWork(
    run: AutograderRunModel,
    attempt: LMSClassicAttempt,
  ): AutograderQuestionWork[] {
    return run.questionSnapshots.map((question) => {
      const answer = attempt.readable
        ? attempt.answers.find(
            (candidate) => candidate.questionId === question.canvasQuestionId,
          )
        : undefined;
      const discovered = classifyDiscoveredAnswer(
        answer,
        attempt.readable,
        run.regradeSubmissions,
      );
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
    run: AutograderRunModel,
    adapter: AbstractLMSAdapter,
    attempt: AutograderAttemptModel,
  ): Promise<void> {
    if (attempt.status === AutograderAttemptStatus.Writing) {
      // A saved successful grade needs no replay, even if the comment was
      // interrupted. If the persisted questions are not all posted, the write
      // may have reached Canvas, so report it instead of retrying.
      if (
        !attempt.questions.every(
          (question) => question.status === AutograderQuestionStatus.Written,
        )
      ) {
        attempt.error = INTERRUPTED_WRITE_ERROR;
      }
      this.finalizeAttempt(attempt);
      await this.store.saveAttempt(attempt);
      return;
    }
    if (attempt.status !== AutograderAttemptStatus.Pending) {
      return;
    }
    try {
      await this.gradeQuestions(run, attempt);
      // Persist the graded questions before the Canvas write. If the process
      // stops here, a resume reuses these results instead of calling the model
      // again, while the attempt is still Pending so it can be prefilled.
      await this.store.saveAttempt(attempt);
      await this.prefillAttempt(run, adapter, attempt);
      this.finalizeAttempt(attempt);
      await this.store.saveAttempt(attempt);
    } catch (error) {
      attempt.status = AutograderAttemptStatus.Error;
      attempt.error = attempt.error ?? attemptFailureMessage(error);
      await this.store.saveAttempt(attempt);
      this.logger.warn(
        `Autograder attempt ${attempt.id} for run ${run.id} failed: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Grades every pending question in memory. Questions already graded are never
   * re-sent to the model. A question with a discovered error or a model error
   * stops the attempt so no partial technical grade is written.
   */
  private async gradeQuestions(
    run: AutograderRunModel,
    attempt: AutograderAttemptModel,
  ): Promise<void> {
    if (
      attempt.questions.some(
        (question) => question.status === AutograderQuestionStatus.Error,
      )
    ) {
      this.markPendingSkipped(attempt.questions);
      return;
    }
    for (const question of attempt.questions) {
      if (question.status !== AutograderQuestionStatus.Pending) {
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
        question.status = AutograderQuestionStatus.Graded;
      } catch (error) {
        // Unavailable or malformed output is a staff-visible error. It is never
        // converted into a zero score and never written to Canvas.
        question.status = AutograderQuestionStatus.Error;
        question.score = null;
        question.comment = null;
        question.humanReviewReason = null;
        question.error = questionFailureMessage(error);
        this.logger.warn(
          `Autograder question ${question.canvasQuestionId} for run ${run.id} failed to grade: ${errorMessage(error)}`,
        );
        this.markPendingSkipped(attempt.questions);
        return;
      }
    }
  }

  /**
   * Prefills the graded questions of one attempt in a single Canvas request.
   *
   * Questions skipped because they already had an instructor grade are left out
   * of the write. If any question has a technical error, nothing is written for
   * the attempt.
   */
  private async prefillAttempt(
    run: AutograderRunModel,
    adapter: AbstractLMSAdapter,
    attempt: AutograderAttemptModel,
  ): Promise<void> {
    if (
      attempt.questions.some(
        (question) => question.status === AutograderQuestionStatus.Error,
      )
    ) {
      return;
    }
    const gradedQuestions = attempt.questions.filter(
      (question) => question.status === AutograderQuestionStatus.Graded,
    );
    if (gradedQuestions.length === 0) {
      return;
    }
    const questions: Parameters<
      AbstractLMSAdapter['putClassicAttemptGrades']
    >[0]['questions'] = [];
    for (const question of gradedQuestions) {
      if (question.score === null || question.comment === null) {
        this.markWriteError(gradedQuestions, MISSING_GRADE_ERROR);
        return;
      }
      questions.push({
        questionId: question.canvasQuestionId,
        score: question.score,
        comment: question.comment,
      });
    }
    // Persist before either external write. A crash cannot leave a replayable
    // grade.
    attempt.status = AutograderAttemptStatus.Writing;
    attempt.error = INTERRUPTED_WRITE_ERROR;
    await this.store.saveAttempt(attempt);
    const result = await adapter.putClassicAttemptGrades({
      quizId: run.canvasQuizId,
      quizSubmissionId: attempt.quizSubmissionId,
      attempt: attempt.attemptNumber,
      questions,
    });
    if (result.outcome === 'success') {
      this.markPosted(gradedQuestions);
      const text = reviewComment(attempt.questions);
      attempt.error = text
        ? 'Grades were prefilled, but the review-comment outcome is unknown. Check SpeedGrader and add the review reasons shown in this report manually if the comment is missing. Do not regrade the attempt.'
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
      this.markWriteError(gradedQuestions, writeOutcomeMessage(result));
    }
  }

  private finalizeAttempt(attempt: AutograderAttemptModel): void {
    const hasError =
      Boolean(attempt.error) ||
      attempt.questions.some(
        (question) => question.status === AutograderQuestionStatus.Error,
      );
    attempt.status = hasError
      ? AutograderAttemptStatus.Error
      : AutograderAttemptStatus.Prefilled;
  }

  private markPosted(questions: AutograderQuestionWork[]): void {
    for (const question of questions) {
      question.status = AutograderQuestionStatus.Written;
      question.error = null;
    }
  }

  private markWriteError(
    questions: AutograderQuestionWork[],
    message: string,
  ): void {
    for (const question of questions) {
      question.status = AutograderQuestionStatus.Error;
      question.error = message;
    }
  }

  private markPendingSkipped(questions: AutograderQuestionWork[]): void {
    for (const question of questions) {
      if (question.status === AutograderQuestionStatus.Pending) {
        question.status = AutograderQuestionStatus.Skipped;
      }
    }
  }

  private async completeRun(run: AutograderRunModel): Promise<void> {
    // Conditional update: a cancel that arrived after the last attempt must
    // not be overwritten by the worker finishing normally.
    if (await this.store.completeRun(run.id)) {
      run.status = AutograderRunStatus.Completed;
      run.completedAt = new Date();
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
