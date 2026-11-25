import { BadRequestException } from '@nestjs/common';
import {
  AutograderRunStatus,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  type QuestionGradingSettings,
} from '@koh/common';
import type { LMSClassicQuiz } from '../../lmsIntegration/lmsIntegration.adapter';
import { EmbeddableQuestionModel } from '../embeddable-question/embeddable-question.entity';
import { AutograderService } from './autograder.service';
import type { AutograderStore } from './autograder.store';
import { AutograderRunModel } from './autograder-run.entity';

const gradingSettings: QuestionGradingSettings = {
  rubric: 'Award points for an accurate answer.',
  feedbackInstructions: 'Be concise.',
  scoreScale: { max: 5, step: 1 },
  checks: [],
};

function quiz(
  mapping: LMSClassicQuiz['essayQuestions'][number]['mapping'],
  overrides: Partial<LMSClassicQuiz> = {},
): LMSClassicQuiz {
  return {
    quizId: 55,
    title: 'Essay Quiz',
    assignmentId: 900,
    postManually: true,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    blockingReason: null,
    essayQuestions: [
      {
        id: 101,
        position: 1,
        text: 'Explain the idea.',
        points: 5,
        mapping,
      },
    ],
    ...overrides,
  };
}

function run(): AutograderRunModel {
  return Object.assign(new AutograderRunModel(), {
    id: 7,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    courseId: 3,
    canvasQuizId: 55,
    assignmentId: 900,
    quizTitle: 'Essay Quiz',
    status: AutograderRunStatus.Running,
    gradingMode: 'final',
    instruction: FINAL_GRADING_INSTRUCTION,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    createdByUserId: 1,
    regradeSubmissions: false,
    includePostedGrades: false,
    questionSnapshots: [],
    error: null,
    completedAt: null,
  });
}

function harness(
  canvasQuiz: LMSClassicQuiz,
  runModel: AutograderRunModel = run(),
) {
  const store = {
    findActiveRun: jest.fn().mockResolvedValue(null),
    createActiveRun: jest.fn(async (data) => ({
      ...run(),
      ...data,
    })),
    findRun: jest.fn(async () => runModel),
    cancelRun: jest.fn(async () => {
      if (runModel.status !== AutograderRunStatus.Running) {
        return false;
      }
      runModel.status = AutograderRunStatus.Cancelled;
      runModel.completedAt = new Date();
      return true;
    }),
    listAttempts: jest.fn().mockResolvedValue([]),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const getClassicQuizCatalog = jest.fn().mockResolvedValue({
    status: LMSApiResponseStatus.Success,
    quizzes: [canvasQuiz],
  });
  const service = new AutograderService(
    {
      getAdapter: jest.fn().mockResolvedValue({
        getClassicQuizCatalog,
      }),
    } as never,
    store as unknown as AutograderStore,
    queue as never,
  );
  return { service, store, queue, getClassicQuizCatalog };
}

describe('AutograderService', () => {
  afterEach(() => jest.restoreAllMocks());

  const detectedMapping = {
    status: 'detected' as const,
    lookupUuid: '11111111-1111-4111-8111-111111111111',
    embeddableQuestionId: 11,
  };

  it('starts one run with frozen Canvas/HelpMe data and default options', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        questionText: 'HelpMe question text.',
        gradingSettings,
      }),
    ]);
    const { service, store, queue, getClassicQuizCatalog } = harness(
      quiz(detectedMapping),
    );

    const started = await service.startRun(3, 1, { canvasQuizId: 55 });

    expect(store.createActiveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: AutograderRunStatus.Running,
        instruction: FINAL_GRADING_INSTRUCTION,
        regradeSubmissions: false,
        includePostedGrades: false,
        questionSnapshots: [
          expect.objectContaining({
            canvasQuestionId: 101,
            embeddableQuestionId: 11,
            questionText: 'HelpMe question text.',
            gradingSettings,
          }),
        ],
      }),
    );
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(started.id).toBe(7);
    expect(started.resumed).toBe(false);
    expect(getClassicQuizCatalog).toHaveBeenCalledWith(55);
  });

  it('passes the regrade options to the frozen run', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        questionText: 'HelpMe question text.',
        gradingSettings,
      }),
    ]);
    const { service, store } = harness(quiz(detectedMapping));

    const started = await service.startRun(3, 1, {
      canvasQuizId: 55,
      regradeSubmissions: true,
      includePostedGrades: true,
    });

    expect(store.createActiveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        regradeSubmissions: true,
        includePostedGrades: true,
      }),
    );
    expect(started.regradeSubmissions).toBe(true);
    expect(started.includePostedGrades).toBe(true);
  });

  it('rejects includePostedGrades without regradeSubmissions', async () => {
    const { service, store, queue } = harness(quiz(detectedMapping));

    await expect(
      service.startRun(3, 1, {
        canvasQuizId: 55,
        includePostedGrades: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('resumes the active run instead of creating another one', async () => {
    const existing = { ...run(), id: 12 };
    const { service, store, queue, getClassicQuizCatalog } = harness(
      quiz(detectedMapping),
    );
    store.findActiveRun.mockResolvedValue(existing);

    const started = await service.startRun(3, 1, { canvasQuizId: 55 });

    expect(started.id).toBe(12);
    expect(started.resumed).toBe(true);
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'autograde-run',
      { runId: 12 },
      expect.any(Object),
    );
    expect(getClassicQuizCatalog).not.toHaveBeenCalled();
  });

  it('resumes only the requested running run', async () => {
    const { service, store, queue } = harness(quiz(detectedMapping));

    const started = await service.startRun(3, 1, {
      canvasQuizId: 55,
      resumeRunId: 7,
    });

    expect(started.id).toBe(7);
    expect(started.resumed).toBe(true);
    expect(store.findRun).toHaveBeenCalledWith(7);
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('refuses to resume a run that already finished', async () => {
    const finished = Object.assign(run(), {
      status: AutograderRunStatus.Completed,
      completedAt: new Date(),
    });
    const { service, store, queue } = harness(quiz(detectedMapping), finished);

    await expect(
      service.startRun(3, 1, { canvasQuizId: 55, resumeRunId: 7 }),
    ).rejects.toThrow('no longer running');
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each([['practice quiz', 'Practice quizzes cannot be autograded.']])(
    'rejects a %s with the blocking reason',
    async (_label, reason) => {
      const { service, store, queue } = harness(
        quiz(detectedMapping, {
          assignmentId: null,
          speedGraderUrl: null,
          postManually: false,
          blockingReason: reason,
        }),
      );

      await expect(
        service.startRun(3, 1, { canvasQuizId: 55 }),
      ).rejects.toThrow(reason);
      expect(store.createActiveRun).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    },
  );

  it('rejects a quiz without a recognized HelpMe question', async () => {
    const { service, store, queue } = harness(
      quiz({ status: 'error', message: 'HelpMe question was not detected.' }),
    );

    await expect(service.startRun(3, 1, { canvasQuizId: 55 })).rejects.toThrow(
      BadRequestException,
    );
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects an assignment that posts grades automatically', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        questionText: 'HelpMe question text.',
        gradingSettings,
      }),
    ]);
    const { service, store, queue } = harness(
      quiz(detectedMapping, { postManually: false }),
    );

    await expect(service.startRun(3, 1, { canvasQuizId: 55 })).rejects.toThrow(
      'Grade Posting Policy to Manual',
    );
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects a Canvas question whose points do not match the HelpMe scale', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        questionText: 'HelpMe question text.',
        gradingSettings,
      }),
    ]);
    const { service, store, queue } = harness(
      quiz(detectedMapping, {
        essayQuestions: [
          {
            id: 101,
            position: 1,
            text: 'Explain the idea.',
            points: 10,
            mapping: detectedMapping,
          },
        ],
      }),
    );

    await expect(service.startRun(3, 1, { canvasQuizId: 55 })).rejects.toThrow(
      'Canvas awards 10 points',
    );
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('cancels a running run', async () => {
    const { service, store } = harness(quiz(detectedMapping));

    const summary = await service.cancelRun(3, 7);

    expect(store.cancelRun).toHaveBeenCalledWith(7);
    expect(summary.status).toBe(AutograderRunStatus.Cancelled);
    expect(summary.completedAt).not.toBeNull();
  });

  it('leaves a finished run unchanged when cancelled', async () => {
    const finished = Object.assign(run(), {
      status: AutograderRunStatus.Completed,
      completedAt: new Date('2026-09-16T00:01:00.000Z'),
    });
    const { service, store } = harness(quiz(detectedMapping), finished);

    const summary = await service.cancelRun(3, 7);

    expect(store.cancelRun).not.toHaveBeenCalled();
    expect(summary.status).toBe(AutograderRunStatus.Completed);
    expect(summary.completedAt).toBe('2026-09-16T00:01:00.000Z');
  });

  it('reports invalid saved grading settings before starting a run', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        gradingSettings: null,
      }),
    ]);
    const { service, store, queue } = harness(quiz(detectedMapping));

    await expect(service.startRun(3, 1, { canvasQuizId: 55 })).rejects.toThrow(
      'Edit and save the HelpMe embeddable question',
    );
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
