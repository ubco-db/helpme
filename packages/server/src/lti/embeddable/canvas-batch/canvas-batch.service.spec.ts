import { BadRequestException } from '@nestjs/common';
import {
  CanvasBatchRunStatus,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  type QuestionGradingSettings,
} from '@koh/common';
import type { LMSClassicQuiz } from '../../../lmsIntegration/lmsIntegration.adapter';
import { EmbeddableQuestionModel } from '../../embeddable-question/embeddable-question.entity';
import { CanvasBatchService } from './canvas-batch.service';
import type { CanvasBatchStore } from './canvas-batch.store';

const gradingSettings: QuestionGradingSettings = {
  rubric: 'Award points for an accurate answer.',
  feedbackInstructions: 'Be concise.',
  scoreScale: { max: 5, step: 1 },
  checks: [],
};

function quiz(mapping: LMSClassicQuiz['essayQuestions'][number]['mapping']) {
  return {
    quizId: 55,
    title: 'Essay Quiz',
    assignmentId: 900,
    postManually: true,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    essayQuestions: [
      {
        id: 101,
        position: 1,
        text: 'Explain the idea.',
        points: 5,
        mapping,
      },
    ],
  } satisfies LMSClassicQuiz;
}

function harness(canvasQuiz: LMSClassicQuiz) {
  const store = {
    findActiveRun: jest.fn().mockResolvedValue(null),
    createActiveRun: jest.fn(async (data) => ({
      id: 7,
      createdAt: new Date('2026-09-16T00:00:00.000Z'),
      ...data,
    })),
    listAttempts: jest.fn().mockResolvedValue([]),
  };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const getClassicQuizCatalog = jest.fn().mockResolvedValue({
    status: LMSApiResponseStatus.Success,
    quizzes: [canvasQuiz],
  });
  const service = new CanvasBatchService(
    {
      getAdapter: jest.fn().mockResolvedValue({
        getClassicQuizCatalog,
      }),
    } as never,
    store as unknown as CanvasBatchStore,
    queue as never,
  );
  return { service, store, queue, getClassicQuizCatalog };
}

describe('CanvasBatchService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('starts one run with the frozen Canvas and HelpMe question data', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      {
        id: 11,
        courseId: 3,
        questionText: 'HelpMe question text.',
        gradingSettings,
      } as EmbeddableQuestionModel,
    ]);
    const { service, store, queue, getClassicQuizCatalog } = harness(
      quiz({
        status: 'detected',
        lookupUuid: '11111111-1111-4111-8111-111111111111',
        embeddableQuestionId: 11,
      }),
    );

    const run = await service.startRun(3, 1, { canvasQuizId: 55 });

    expect(store.createActiveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CanvasBatchRunStatus.Running,
        instruction: FINAL_GRADING_INSTRUCTION,
        questions: [
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
    expect(run.id).toBe(7);
    expect(getClassicQuizCatalog).toHaveBeenCalledWith(55);
  });

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

  it('reports invalid saved grading settings before starting a run', async () => {
    jest.spyOn(EmbeddableQuestionModel, 'find').mockResolvedValue([
      Object.assign(new EmbeddableQuestionModel(), {
        id: 11,
        courseId: 3,
        gradingSettings: null,
      }),
    ]);
    const { service, store, queue } = harness(
      quiz({
        status: 'detected',
        lookupUuid: '11111111-1111-4111-8111-111111111111',
        embeddableQuestionId: 11,
      }),
    );
    await expect(service.startRun(3, 1, { canvasQuizId: 55 })).rejects.toThrow(
      'Edit and save the HelpMe question',
    );
    expect(store.createActiveRun).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });
});
