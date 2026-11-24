import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In } from 'typeorm';
import {
  AUTOGRADER_GRADING_MODE,
  AutograderAttemptStatus,
  AutograderErrorRecord,
  AutograderFlagRecord,
  AutograderQuestionSnapshot,
  AutograderQuestionStatus,
  AutograderQuizOption,
  AutograderRunCounts,
  AutograderRunReport,
  AutograderRunStatus,
  AutograderRunSummary,
  ERROR_MESSAGES,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  StartAutograderRunParams,
  StartAutograderRunResponse,
  questionGradingSettingsSchema,
  AUTOGRADER_QUEUE_NAME,
} from '@koh/common';
import { LMSIntegrationService } from '../../lmsIntegration/lmsIntegration.service';
import { EmbeddableQuestionModel } from '../embeddable-question/embeddable-question.entity';
import { AutograderRunModel } from './autograder-run.entity';
import { AutograderAttemptModel } from './autograder-attempt.entity';
import { AutograderStore } from './autograder.store';
import { MANUAL_POSTING_REQUIRED_MESSAGE } from './autograder.messages';
import type {
  AbstractLMSAdapter,
  LMSClassicQuestionMapping,
  LMSClassicQuiz,
  LMSClassicQuizQuestion,
} from '../../lmsIntegration/lmsIntegration.adapter';

type ResolvedQuestions =
  | { status: 'ready'; questions: AutograderQuestionSnapshot[] }
  | { status: 'error'; detectedQuestions: number; error: string };

type DetectedQuestion = LMSClassicQuizQuestion & {
  mapping: Extract<LMSClassicQuestionMapping, { status: 'detected' }>;
};

/**
 * Staff-facing operations for the autograder: listing quizzes, starting (or
 * resuming) a run, and reading run state and reports. Starting a run is the
 * only staff action; it owns discovery, grading, and the SpeedGrader prefill,
 * and never posts or releases grades.
 */
@Injectable()
export class AutograderService {
  constructor(
    private readonly lmsIntegrationService: LMSIntegrationService,
    private readonly store: AutograderStore,
    @InjectQueue(AUTOGRADER_QUEUE_NAME)
    private readonly queue: Queue,
  ) {}

  /**
   * Classic quizzes with mappings detected from their embedded LTI links.
   *
   * This reads Canvas (quizzes, questions, resource links), so it is only called
   * when the page loads and when a run starts. The report endpoint polls the
   * database only ('cause a call to this would be expensive compute wise).
   */
  async listQuizzes(courseId: number): Promise<AutograderQuizOption[]> {
    const adapter = await this.getAdapter(courseId);
    const result = await adapter.getClassicQuizCatalog();
    if (result.status !== LMSApiResponseStatus.Success) {
      throw new BadRequestException(result.message ?? result.status);
    }
    return Promise.all(
      result.quizzes.map(async (quiz) => {
        const resolved = quiz.blockingReason
          ? null
          : await this.resolveQuestions(courseId, quiz);
        const detectedQuestions = resolved
          ? resolved.status === 'ready'
            ? resolved.questions.length
            : resolved.detectedQuestions
          : 0;
        const blockingReason =
          quiz.blockingReason ??
          (resolved?.status === 'error' ? resolved.error : null);
        return {
          canvasQuizId: quiz.quizId,
          assignmentId: quiz.assignmentId,
          title: quiz.title,
          postManually: quiz.postManually,
          speedGraderUrl: quiz.speedGraderUrl,
          detectedQuestions,
          blockingReason,
          essayQuestions: quiz.essayQuestions.map((question) => ({
            canvasQuestionId: question.id,
            position: question.position,
            text: question.text,
            points: question.points,
          })),
        };
      }),
    );
  }

  async listRuns(courseId: number): Promise<AutograderRunSummary[]> {
    const runs = await this.store.listRuns(courseId);
    // Each summary needs the run's attempts. Fetching them in parallel keeps
    // the run list from doing one query per run in sequence.
    return Promise.all(runs.map((run) => this.buildSummary(run)));
  }

  /**
   * Starts a run, or resumes the running one for the same course + quiz.
   *
   * When no run is active, a new run is created. Its options are frozen for the
   * life of the run, including the regrade flags, so a resume can never change
   * what the worker writes.
   */
  async startRun(
    courseId: number,
    userId: number,
    params: StartAutograderRunParams,
  ): Promise<StartAutograderRunResponse> {
    const regradeSubmissions = params.regradeSubmissions ?? false;
    const includePostedGrades = params.includePostedGrades ?? false;
    if (includePostedGrades && !regradeSubmissions) {
      throw new BadRequestException(
        'Include submissions with posted grades requires Regrade submissions to be checked.',
      );
    }

    const existing = await this.store.findActiveRun(
      courseId,
      params.canvasQuizId,
    );
    if (existing) {
      await this.enqueue(existing.id);
      return { ...(await this.buildSummary(existing)), resumed: true };
    }

    const adapter = await this.getAdapter(courseId);
    const result = await adapter.getClassicQuizCatalog(params.canvasQuizId);
    if (result.status !== LMSApiResponseStatus.Success) {
      throw new BadRequestException(result.message ?? result.status);
    }
    const quiz = result.quizzes.find(
      (candidate) => candidate.quizId === params.canvasQuizId,
    );
    if (!quiz) {
      throw new BadRequestException(
        result.message ??
          'The selected Canvas quiz was not found in this course, or it is not a Classic quiz.',
      );
    }
    if (quiz.blockingReason) {
      throw new BadRequestException(quiz.blockingReason);
    }
    if (!quiz.postManually) {
      throw new BadRequestException(MANUAL_POSTING_REQUIRED_MESSAGE);
    }
    if (quiz.assignmentId === null || quiz.speedGraderUrl === null) {
      throw new BadRequestException(
        'This Canvas quiz has no graded assignment, so it cannot be autograded.',
      );
    }

    const resolved = await this.resolveQuestions(courseId, quiz);
    if (resolved.status === 'error') {
      throw new BadRequestException(resolved.error);
    }

    const run = await this.store.createActiveRun({
      courseId,
      canvasQuizId: quiz.quizId,
      assignmentId: quiz.assignmentId,
      quizTitle: quiz.title,
      status: AutograderRunStatus.Running,
      gradingMode: AUTOGRADER_GRADING_MODE,
      instruction: FINAL_GRADING_INSTRUCTION,
      speedGraderUrl: quiz.speedGraderUrl,
      createdByUserId: userId,
      regradeSubmissions,
      includePostedGrades,
      questionSnapshots: resolved.questions,
      completedAt: null,
    });
    await this.enqueue(run.id);
    return { ...(await this.buildSummary(run)), resumed: false };
  }

  private async getAdapter(courseId: number): Promise<AbstractLMSAdapter> {
    const adapter = await this.lmsIntegrationService.getAdapter(courseId);
    if (!adapter) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
      );
    }
    return adapter;
  }

  private async resolveQuestions(
    courseId: number,
    quiz: LMSClassicQuiz,
  ): Promise<ResolvedQuestions> {
    if (quiz.essayQuestions.length === 0) {
      return {
        status: 'error',
        detectedQuestions: 0,
        error:
          'This Canvas quiz has no essay questions, so there is nothing for the autograder to grade.',
      };
    }
    const detected = quiz.essayQuestions.filter(
      (question): question is DetectedQuestion =>
        question.mapping.status === 'detected',
    );
    const mappingError = quiz.essayQuestions.find(
      (question) => question.mapping.status === 'error',
    );
    if (mappingError?.mapping.status === 'error') {
      return {
        status: 'error',
        detectedQuestions: detected.length,
        error: mappingError.mapping.message,
      };
    }

    const ids = detected.map(
      (question) => question.mapping.embeddableQuestionId,
    );
    if (new Set(ids).size !== ids.length) {
      return {
        status: 'error',
        detectedQuestions: detected.length,
        error:
          'The same HelpMe embeddable question is inserted into this Canvas quiz more than once. Each Canvas question needs its own HelpMe question so the grades map correctly.',
      };
    }
    const helpMeQuestions = await EmbeddableQuestionModel.find({
      where: { courseId, id: In(ids) },
    });
    const helpMeById = new Map(
      helpMeQuestions.map((question) => [question.id, question]),
    );
    const questions: AutograderQuestionSnapshot[] = [];
    for (const canvasQuestion of detected) {
      const mapping = canvasQuestion.mapping;
      const helpMeQuestion = helpMeById.get(mapping.embeddableQuestionId);
      if (!helpMeQuestion) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position} embeds a HelpMe question that is not available in this course. It may have been deleted, or the HelpMe course may not be connected to this Canvas course.`,
        };
      }
      const settings = questionGradingSettingsSchema.safeParse(
        helpMeQuestion.gradingSettings,
      );
      if (!settings.success) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position} has invalid grading settings. Edit and save the HelpMe embeddable question before starting a new run.`,
        };
      }
      const helpMeMax = settings.data.scoreScale.max;
      if (canvasQuestion.points !== helpMeMax) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position}: Canvas awards ${canvasQuestion.points} points but the HelpMe embeddable question has a maximum of ${helpMeMax}. These must match. Edit one of them so the maximum scores are equal.`,
        };
      }
      questions.push({
        canvasQuestionId: canvasQuestion.id,
        lookupUuid: mapping.lookupUuid,
        position: canvasQuestion.position,
        text: canvasQuestion.text,
        embeddableQuestionId: mapping.embeddableQuestionId,
        canvasPoints: canvasQuestion.points,
        helpMeMax,
        questionText: helpMeQuestion.questionText,
        gradingSettings: settings.data,
      });
    }
    return { status: 'ready', questions };
  }

  async getReport(
    courseId: number,
    runId: number,
  ): Promise<AutograderRunReport> {
    const run = await this.findRunForCourse(courseId, runId);
    const attempts = await this.store.listAttempts(run.id);
    const errors = this.errorRecords(attempts, run.status);
    return {
      run: this.toSummary(run, attempts, errors),
      errors,
      flags: this.flagRecords(attempts),
    };
  }

  private flagRecords(
    attempts: AutograderAttemptModel[],
  ): AutograderFlagRecord[] {
    return attempts.flatMap((attempt) =>
      attempt.questions.flatMap((question) =>
        question.humanReviewReason
          ? [
              {
                quizSubmissionId: attempt.quizSubmissionId,
                attemptNumber: attempt.attemptNumber,
                position: question.position,
                canvasQuestionId: question.canvasQuestionId,
                reason: question.humanReviewReason,
              },
            ]
          : [],
      ),
    );
  }

  private async findRunForCourse(
    courseId: number,
    runId: number,
  ): Promise<AutograderRunModel> {
    const run = await this.store.findRun(runId);
    if (!run || run.courseId !== courseId) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.notFound);
    }
    return run;
  }

  /**
   * Enqueues the single run job with a deterministic id and removal options, so
   * repeated starts of the same run never duplicate work.
   */
  private async enqueue(runId: number): Promise<void> {
    await this.queue.add(
      'autograde-run',
      { runId },
      {
        // A deterministic job id makes repeated starts of the same run a no-op
        // rather than a second queue entry.
        jobId: `autograder-run-${runId}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async buildSummary(
    run: AutograderRunModel,
  ): Promise<AutograderRunSummary> {
    const attempts = await this.store.listAttempts(run.id);
    return this.toSummary(
      run,
      attempts,
      this.errorRecords(attempts, run.status),
    );
  }

  private toSummary(
    run: AutograderRunModel,
    attempts: AutograderAttemptModel[],
    errors: AutograderErrorRecord[],
  ): AutograderRunSummary {
    return {
      id: run.id,
      courseId: run.courseId,
      canvasQuizId: run.canvasQuizId,
      assignmentId: run.assignmentId,
      quizTitle: run.quizTitle,
      status: run.status,
      error: run.error ?? null,
      gradingMode: run.gradingMode,
      instruction: run.instruction,
      speedGraderUrl: run.speedGraderUrl,
      regradeSubmissions: run.regradeSubmissions,
      includePostedGrades: run.includePostedGrades,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      counts: this.counts(attempts, errors),
      questions: run.questionSnapshots,
    };
  }

  private counts(
    attempts: AutograderAttemptModel[],
    errors: AutograderErrorRecord[],
  ): AutograderRunCounts {
    const questions = attempts.flatMap((attempt) => attempt.questions);
    const byStatus = (status: AutograderQuestionStatus) =>
      questions.filter((question) => question.status === status).length;
    return {
      attempts: attempts.length,
      questions: questions.length,
      pending: byStatus(AutograderQuestionStatus.Pending),
      graded:
        byStatus(AutograderQuestionStatus.Graded) +
        byStatus(AutograderQuestionStatus.Written),
      written: byStatus(AutograderQuestionStatus.Written),
      skipped: byStatus(AutograderQuestionStatus.Skipped),
      errors: errors.filter(
        (error) => error.status === AutograderQuestionStatus.Error,
      ).length,
      flagged: questions.filter(
        (question) => question.humanReviewReason !== null,
      ).length,
    };
  }

  private errorRecords(
    attempts: AutograderAttemptModel[],
    runStatus: AutograderRunStatus,
  ): AutograderErrorRecord[] {
    const records: AutograderErrorRecord[] = [];
    for (const attempt of attempts) {
      // The recovery marker is not a failure while a write is still in progress.
      if (
        runStatus === AutograderRunStatus.Running &&
        attempt.status === AutograderAttemptStatus.Writing
      ) {
        continue;
      }
      const questionErrors = new Set<string | null>();
      for (const question of attempt.questions) {
        if (question.status !== AutograderQuestionStatus.Error) {
          continue;
        }
        questionErrors.add(question.error);
        records.push({
          source: 'question',
          quizSubmissionId: attempt.quizSubmissionId,
          attemptNumber: attempt.attemptNumber,
          position: question.position,
          canvasQuestionId: question.canvasQuestionId,
          status: question.status,
          error: question.error,
        });
      }
      if (attempt.error && !questionErrors.has(attempt.error)) {
        records.push({
          source: 'attempt',
          quizSubmissionId: attempt.quizSubmissionId,
          attemptNumber: attempt.attemptNumber,
          position: null,
          canvasQuestionId: null,
          status: AutograderQuestionStatus.Error,
          error: attempt.error,
        });
      }
    }
    return records;
  }
}
