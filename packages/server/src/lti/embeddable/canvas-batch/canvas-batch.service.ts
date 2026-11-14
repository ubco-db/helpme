import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { In } from 'typeorm';
import {
  CanvasBatchQuestionSnapshot,
  CanvasBatchQuizOption,
  CanvasBatchErrorRecord,
  CanvasBatchFlagRecord,
  CanvasBatchRunCounts,
  CanvasBatchRunReport,
  CanvasBatchRunStatus,
  CanvasBatchAttemptStatus,
  CanvasBatchRunSummary,
  CanvasBatchQuestionStatus,
  CLASSIC_CANVAS_GRADING_MODE,
  ERROR_MESSAGES,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  StartCanvasBatchRunParams,
  questionGradingSettingsSchema,
} from '@koh/common';
import { LMSIntegrationService } from '../../../lmsIntegration/lmsIntegration.service';
import { EmbeddableQuestionModel } from '../../embeddable-question/embeddable-question.entity';
import { CanvasBatchRunModel } from './canvas-batch-run.entity';
import { CanvasBatchAttemptModel } from './canvas-batch-attempt.entity';
import { CanvasBatchStore } from './canvas-batch.store';
import {
  CANVAS_BATCH_JOB,
  CANVAS_BATCH_QUEUE,
  canvasBatchJobId,
} from './canvas-batch.constants';
import type {
  AbstractLMSAdapter,
  LMSClassicQuestionMapping,
  LMSClassicQuiz,
  LMSClassicQuizQuestion,
} from '../../../lmsIntegration/lmsIntegration.adapter';

type ResolvedQuestions =
  | { status: 'ready'; questions: CanvasBatchQuestionSnapshot[] }
  | { status: 'error'; detectedQuestions: number; error: string };

type DetectedQuestion = LMSClassicQuizQuestion & {
  mapping: Extract<LMSClassicQuestionMapping, { status: 'detected' }>;
};

/**
 * Staff-facing operations for Classic Canvas batch runs: listing quizzes,
 * starting (or resuming) a run, and reading run state and reports. Starting a
 * run is the only staff action; it owns discovery, grading, and the SpeedGrader
 * prefill, and never posts or releases grades.
 */
@Injectable()
export class CanvasBatchService {
  constructor(
    private readonly lmsIntegrationService: LMSIntegrationService,
    private readonly store: CanvasBatchStore,
    @InjectQueue(CANVAS_BATCH_QUEUE)
    private readonly queue: Queue,
  ) {}

  /** Classic quizzes with mappings detected from their embedded LTI links. */
  async listClassicQuizzes(courseId: number): Promise<CanvasBatchQuizOption[]> {
    const adapter = await this.lmsIntegrationService.getAdapter(courseId);
    if (!adapter) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
      );
    }
    const result = await adapter.getClassicQuizCatalog();
    if (result.status !== LMSApiResponseStatus.Success) {
      throw new BadRequestException(result.status);
    }
    return Promise.all(
      result.quizzes.map(async (quiz) => {
        const resolved = await this.resolveQuestions(courseId, quiz);
        return {
          canvasQuizId: quiz.quizId,
          assignmentId: quiz.assignmentId,
          title: quiz.title,
          postManually: quiz.postManually,
          speedGraderUrl: quiz.speedGraderUrl,
          detectedQuestions:
            resolved.status === 'ready'
              ? resolved.questions.length
              : resolved.detectedQuestions,
          mappingError: resolved.status === 'ready' ? null : resolved.error,
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

  async listRuns(courseId: number): Promise<CanvasBatchRunSummary[]> {
    const runs = await this.store.listRuns(courseId);
    const summaries: CanvasBatchRunSummary[] = [];
    for (const run of runs) {
      summaries.push(await this.buildSummary(run));
    }
    return summaries;
  }

  /**
   * Starts a run, or resumes the running one for the same course + quiz.
   *
   * After a run completes, starting again creates a new intake run that picks up
   * later attempts; attempts that already carry a Canvas grade are skipped
   * rather than regraded.
   */
  async startRun(
    courseId: number,
    userId: number,
    params: StartCanvasBatchRunParams,
  ): Promise<CanvasBatchRunSummary> {
    const existing = await this.store.findActiveRun(
      courseId,
      params.canvasQuizId,
    );
    if (existing) {
      await this.enqueue(existing.id);
      return this.buildSummary(existing);
    }

    const adapter = await this.lmsIntegrationService.getAdapter(courseId);
    if (!adapter) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
      );
    }
    const result = await adapter.getClassicQuizCatalog(params.canvasQuizId);
    if (result.status !== LMSApiResponseStatus.Success) {
      throw new BadRequestException(result.status);
    }
    const quiz = result.quizzes.find(
      (candidate) => candidate.quizId === params.canvasQuizId,
    );
    if (!quiz) {
      throw new BadRequestException(
        'The selected Canvas quiz was not found in this course.',
      );
    }
    if (!quiz.postManually) {
      throw new BadRequestException(
        'This Canvas assignment is not set to post grades manually. Set it to manual posting before starting a batch run.',
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
      canvasQuizTitle: quiz.title,
      status: CanvasBatchRunStatus.Running,
      gradingMode: CLASSIC_CANVAS_GRADING_MODE,
      instruction: FINAL_GRADING_INSTRUCTION,
      speedGraderUrl: quiz.speedGraderUrl,
      createdByUserId: userId,
      questions: resolved.questions,
      completedAt: null,
    });
    await this.enqueue(run.id);
    return this.buildSummary(run);
  }

  private async resolveQuestions(
    courseId: number,
    quiz: LMSClassicQuiz,
  ): Promise<ResolvedQuestions> {
    if (quiz.essayQuestions.length === 0) {
      return {
        status: 'error',
        detectedQuestions: 0,
        error: 'This Canvas quiz has no essay questions.',
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
        error: 'The same HelpMe question is embedded more than once.',
      };
    }
    const helpMeQuestions = await EmbeddableQuestionModel.find({
      where: { courseId, id: In(ids) },
    });
    const helpMeById = new Map(
      helpMeQuestions.map((question) => [question.id, question]),
    );
    const questions: CanvasBatchQuestionSnapshot[] = [];
    for (const canvasQuestion of detected) {
      const mapping = canvasQuestion.mapping;
      const helpMeQuestion = helpMeById.get(mapping.embeddableQuestionId);
      if (!helpMeQuestion) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position} embeds a HelpMe question that is not available in this course. Perhaps it was deleted or the HelpMe course is integrated with a different course?`,
        };
      }
      const settings = questionGradingSettingsSchema.safeParse(
        helpMeQuestion.gradingSettings,
      );
      if (!settings.success) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position} has invalid grading settings (could not be parsed). Edit and save the HelpMe embeddable question before starting a new run.`,
        };
      }
      const helpMeMax = settings.data.scoreScale.max;
      if (canvasQuestion.points !== helpMeMax) {
        return {
          status: 'error',
          detectedQuestions: detected.length,
          error: `Question ${canvasQuestion.position}: Canvas awards ${canvasQuestion.points} points but the HelpMe embeddable question has a maximum of ${helpMeMax}. These two need to match (probably by editing the HelpMe embeddable question).`,
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
  ): Promise<CanvasBatchRunReport> {
    const run = await this.findRunForCourse(courseId, runId);
    const attempts = await this.store.listAttempts(run.id);
    const errors = this.errorRecords(attempts, run.status);
    return {
      run: this.toSummary(run, attempts),
      errors,
      flags: this.flagRecords(attempts),
    };
  }

  private flagRecords(
    attempts: CanvasBatchAttemptModel[],
  ): CanvasBatchFlagRecord[] {
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
  ): Promise<CanvasBatchRunModel> {
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
      CANVAS_BATCH_JOB,
      { runId },
      {
        jobId: canvasBatchJobId(runId),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  private async buildSummary(
    run: CanvasBatchRunModel,
  ): Promise<CanvasBatchRunSummary> {
    const attempts = await this.store.listAttempts(run.id);
    return this.toSummary(run, attempts);
  }

  private toSummary(
    run: CanvasBatchRunModel,
    attempts: CanvasBatchAttemptModel[],
  ): CanvasBatchRunSummary {
    return {
      id: run.id,
      courseId: run.courseId,
      canvasQuizId: run.canvasQuizId,
      assignmentId: run.assignmentId,
      canvasQuizTitle: run.canvasQuizTitle,
      status: run.status,
      error: run.error ?? null,
      gradingMode: run.gradingMode,
      instruction: run.instruction,
      speedGraderUrl: run.speedGraderUrl,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt ? run.completedAt.toISOString() : null,
      counts: this.counts(attempts, run.status),
      questions: run.questions,
    };
  }

  private counts(
    attempts: CanvasBatchAttemptModel[],
    runStatus: CanvasBatchRunStatus,
  ): CanvasBatchRunCounts {
    const questions = attempts.flatMap((attempt) => attempt.questions);
    const errors = this.errorRecords(attempts, runStatus);
    const byStatus = (status: CanvasBatchQuestionStatus) =>
      questions.filter((question) => question.status === status).length;
    return {
      attempts: attempts.length,
      questions: questions.length,
      pending: byStatus(CanvasBatchQuestionStatus.Pending),
      graded:
        byStatus(CanvasBatchQuestionStatus.Graded) +
        byStatus(CanvasBatchQuestionStatus.Posted),
      posted: byStatus(CanvasBatchQuestionStatus.Posted),
      skipped: byStatus(CanvasBatchQuestionStatus.Skipped),
      errors: errors.filter(
        (error) => error.status === CanvasBatchQuestionStatus.Error,
      ).length,
      flagged: questions.filter(
        (question) => question.humanReviewReason !== null,
      ).length,
    };
  }

  private errorRecords(
    attempts: CanvasBatchAttemptModel[],
    runStatus: CanvasBatchRunStatus,
  ): CanvasBatchErrorRecord[] {
    const records: CanvasBatchErrorRecord[] = [];
    for (const attempt of attempts) {
      // The recovery marker is not a failure while a write is still in progress.
      if (
        runStatus === CanvasBatchRunStatus.Running &&
        attempt.status === CanvasBatchAttemptStatus.Writing
      )
        continue;
      const questionErrors = new Set<string | null>();
      for (const question of attempt.questions) {
        if (question.status !== CanvasBatchQuestionStatus.Error) {
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
          status: CanvasBatchQuestionStatus.Error,
          error: attempt.error,
        });
      }
    }
    return records;
  }
}
