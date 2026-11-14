import {
  CanvasBatchAttemptStatus,
  CanvasBatchQuestionStatus,
  CanvasBatchRunStatus,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  type CanvasBatchQuestionSnapshot,
  type QuestionGradingSettings,
} from '@koh/common';
import type { LMSClassicAttempt } from '../../../lmsIntegration/lmsIntegration.adapter';
import type { CanvasBatchAttemptModel } from './canvas-batch-attempt.entity';
import { CanvasBatchService } from './canvas-batch.service';
import { CanvasBatchRunnerService } from './canvas-batch-runner.service';
import type { CanvasBatchRunModel } from './canvas-batch-run.entity';
import type { CanvasBatchStore } from './canvas-batch.store';

const gradingSettings: QuestionGradingSettings = {
  rubric: 'Award points for an accurate answer.',
  feedbackInstructions: 'Be concise.',
  scoreScale: { max: 5, step: 1 },
  checks: [],
};

function question(id: number, position: number): CanvasBatchQuestionSnapshot {
  return {
    canvasQuestionId: id,
    lookupUuid: `${String(id).padStart(8, '0')}-1111-4111-8111-111111111111`,
    position,
    text: `Question ${position}`,
    embeddableQuestionId: id,
    canvasPoints: 5,
    helpMeMax: 5,
    questionText: `Question ${position}`,
    gradingSettings,
  };
}

const questions = [question(101, 1), question(102, 2)];

function run(): CanvasBatchRunModel {
  return {
    id: 7,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    courseId: 3,
    canvasQuizId: 55,
    assignmentId: 900,
    canvasQuizTitle: 'Essay Quiz',
    status: CanvasBatchRunStatus.Running,
    gradingMode: 'final',
    instruction: FINAL_GRADING_INSTRUCTION,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    createdByUserId: 1,
    questions,
    completedAt: null,
  } as CanvasBatchRunModel;
}

function canvasAttempt(): LMSClassicAttempt {
  return {
    quizSubmissionId: 500,
    userId: 42,
    attempt: 1,
    postedAt: null,
    excused: false,
    readable: true,
    answers: [
      { questionId: 101, text: 'First answer.', points: null, comment: null },
      { questionId: 102, text: 'Second answer.', points: null, comment: null },
    ],
  };
}

function evaluation(score: number) {
  return {
    score,
    comment: 'Good answer.',
    appliedRequirements: [],
    maxScore: 5,
    model: 'test-model',
    gradingSnapshot: {
      questionText: 'Question',
      gradingSettings,
      gradingMode: 'final' as const,
      instruction: FINAL_GRADING_INSTRUCTION,
    },
    reasons: ['accurate'],
    humanReviewReason: null,
  };
}

function harness(
  evaluate: jest.Mock,
  options: {
    postedAt?: string;
    existingGrade?: { score: number; comment: string };
  } = {},
) {
  const batchRun = run();
  const discoveredAttempt = canvasAttempt();
  discoveredAttempt.postedAt = options.postedAt ?? null;
  if (options.existingGrade) {
    discoveredAttempt.answers[0].points = options.existingGrade.score;
    discoveredAttempt.answers[0].comment = options.existingGrade.comment;
  }
  const attempts: CanvasBatchAttemptModel[] = [];
  const store = {
    withRunLock: jest.fn(async (_runId: number, work: () => Promise<void>) =>
      work(),
    ),
    findRun: jest.fn(async () => structuredClone(batchRun)),
    listAttempts: jest.fn(async () => structuredClone(attempts)),
    findAttempt: jest.fn(
      async (_runId: number, submissionId: number, attemptNumber: number) =>
        structuredClone(
          attempts.find(
            (item) =>
              item.quizSubmissionId === submissionId &&
              item.attemptNumber === attemptNumber,
          ) ?? null,
        ),
    ),
    createAttempt: jest.fn(async (data: Partial<CanvasBatchAttemptModel>) => {
      const created = {
        id: 1,
        createdAt: new Date(),
        ...data,
      } as CanvasBatchAttemptModel;
      attempts.push(structuredClone(created));
      return created;
    }),
    saveAttempt: jest.fn(async (item: CanvasBatchAttemptModel) => {
      attempts[attempts.findIndex((saved) => saved.id === item.id)] =
        structuredClone(item);
      return item;
    }),
    saveRun: jest.fn(async (item: CanvasBatchRunModel) =>
      Object.assign(batchRun, item),
    ),
  };
  const adapter = {
    getClassicAttemptSnapshots: jest.fn().mockResolvedValue({
      status: LMSApiResponseStatus.Success,
      snapshot: { quizId: 55, attempts: [discoveredAttempt] },
    }),
    putClassicAttemptGrades: jest
      .fn()
      .mockResolvedValue({ outcome: 'success' }),
    putSubmissionComment: jest.fn().mockResolvedValue({ outcome: 'success' }),
  };
  const getAdapter = jest.fn().mockResolvedValue(adapter);
  const runner = new CanvasBatchRunnerService(
    store as unknown as CanvasBatchStore,
    { getAdapter } as never,
    { evaluate } as never,
  );
  return { runner, attempts, adapter, batchRun, store, getAdapter };
}

describe('CanvasBatchRunnerService', () => {
  it('does not show the recovery marker as a failure during an active write', async () => {
    const { runner, adapter, store } = harness(
      jest.fn().mockResolvedValue(evaluation(4)),
    );
    adapter.putClassicAttemptGrades.mockImplementationOnce(async () => {
      const report = await new CanvasBatchService(
        {} as never,
        store as unknown as CanvasBatchStore,
        {} as never,
      ).getReport(3, 7);
      expect(report.errors).toEqual([]);
      expect(report.run.counts.errors).toBe(0);
      return { outcome: 'success' };
    });
    await runner.run(7);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
  });
  it.each(['grade', 'review comment'])(
    'does not replay a %s after Canvas accepts it but persistence fails',
    async (stage) => {
      const evaluate = jest.fn().mockResolvedValue({
        ...evaluation(4),
        humanReviewReason: 'Ambiguous rubric.',
      });
      const { runner, adapter, attempts, batchRun, store } = harness(evaluate);
      const save = store.saveAttempt.getMockImplementation()!;
      const write =
        stage === 'grade'
          ? adapter.putClassicAttemptGrades
          : adapter.putSubmissionComment;
      write.mockImplementationOnce(async () => {
        // Canvas accepted the request, then the database became unavailable.
        store.saveAttempt.mockRejectedValue(new Error('Database unavailable'));
        return { outcome: 'success' };
      });
      await runner.run(7);
      expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Writing);
      store.saveAttempt.mockImplementation(save);
      batchRun.status = CanvasBatchRunStatus.Running;
      await runner.run(7);

      expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
      expect(adapter.putSubmissionComment).toHaveBeenCalledTimes(
        stage === 'grade' ? 0 : 1,
      );
      expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Error);
      expect(attempts[0].error).toContain('SpeedGrader');
      expect(attempts[0].error).toContain('unknown');
      const report = await new CanvasBatchService(
        {} as never,
        store as unknown as CanvasBatchStore,
        {} as never,
      ).getReport(3, 7);
      expect(report.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'attempt',
            error: expect.stringContaining('unknown'),
          }),
        ]),
      );
      expect(report.flags).toHaveLength(2);
    },
  );

  it('does not send a grade when its write marker cannot be saved', async () => {
    const { runner, adapter, store } = harness(
      jest.fn().mockResolvedValue(evaluation(4)),
    );
    const save = store.saveAttempt.getMockImplementation()!;
    store.saveAttempt.mockImplementation(async (attempt) => {
      if (attempt.status === CanvasBatchAttemptStatus.Writing)
        throw new Error('Database unavailable');
      return save(attempt);
    });
    await runner.run(7);
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('reports a discovery failure with recovery steps', async () => {
    const status = LMSApiResponseStatus.Unauthorized;
    const { runner, adapter, batchRun, store } = harness(jest.fn());
    adapter.getClassicAttemptSnapshots.mockResolvedValue({ status });
    await runner.run(7);
    expect(batchRun.status).toBe(CanvasBatchRunStatus.Failed);
    expect(batchRun.error).toContain(status);
    expect(batchRun.error).toContain('start a new run');
    const reportService = new CanvasBatchService(
      {} as never,
      store as unknown as CanvasBatchStore,
      {} as never,
    );
    const report = await reportService.getReport(
      batchRun.courseId,
      batchRun.id,
    );
    expect(report.run).toMatchObject({
      status: CanvasBatchRunStatus.Failed,
      error: expect.stringContaining(status),
    });
    expect(report.run.completedAt).not.toBeNull();
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('persists transport initialization failure', async () => {
    const { runner, getAdapter, batchRun } = harness(jest.fn());
    getAdapter.mockRejectedValue(new Error('Connection unavailable'));
    await runner.run(7);
    expect(batchRun.status).toBe(CanvasBatchRunStatus.Failed);
    expect(batchRun.error).toContain('Connection unavailable');
  });

  it.each(['rejected', 'unknown'])(
    'retains the %s write outcome without retrying',
    async (outcome) => {
      const { runner, adapter, attempts } = harness(
        jest.fn().mockResolvedValue(evaluation(4)),
      );
      adapter.putClassicAttemptGrades.mockResolvedValue({
        outcome,
        message: 'Connection failed',
      });
      await runner.run(7);
      expect(attempts[0].questions[0].error).toContain(outcome);
      expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
      expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Error);
    },
  );

  it('adds one review comment for flagged questions after prefilling', async () => {
    const evaluate = jest
      .fn()
      .mockResolvedValueOnce(evaluation(4))
      .mockResolvedValueOnce({
        ...evaluation(3),
        humanReviewReason: 'Potentially harmful content.',
      });
    const { runner, attempts, adapter } = harness(evaluate);

    await runner.run(7);

    expect(adapter.putSubmissionComment).toHaveBeenCalledTimes(1);
    expect(adapter.putSubmissionComment).toHaveBeenCalledWith({
      assignmentId: 900,
      userId: 42,
      text: expect.stringContaining(
        'HUMAN REVIEW REQUIRED (HelpMe AI)\n\nQuestion 2 review reason: Potentially harmful content.',
      ),
    });
    expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Prefilled);
  });

  it('reports a failed review comment without undoing the prefill', async () => {
    const { runner, attempts, adapter } = harness(
      jest
        .fn()
        .mockResolvedValue({ ...evaluation(4), humanReviewReason: 'Unclear.' }),
    );
    adapter.putSubmissionComment.mockResolvedValue({
      outcome: 'rejected',
      httpStatus: 401,
    });

    await runner.run(7);

    expect(attempts[0].questions[0].status).toBe(
      CanvasBatchQuestionStatus.Posted,
    );
    expect(attempts[0].error).toContain('review comment was not added');
    expect(attempts[0].error).toContain('Do not regrade');
    expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Error);
  });

  it('grades a student and sends every question in one Canvas request', async () => {
    const evaluate = jest
      .fn()
      .mockResolvedValueOnce(evaluation(4))
      .mockResolvedValueOnce(evaluation(3));
    const { runner, attempts, adapter } = harness(evaluate);

    await runner.run(7);

    expect(adapter.putSubmissionComment).not.toHaveBeenCalled();
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledWith({
      quizId: 55,
      quizSubmissionId: 500,
      attempt: 1,
      questions: [
        { questionId: 101, score: 4, comment: 'Good answer.' },
        { questionId: 102, score: 3, comment: 'Good answer.' },
      ],
    });
    expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Prefilled);
    expect(
      attempts[0].questions.every(
        (item) => item.status === CanvasBatchQuestionStatus.Posted,
      ),
    ).toBe(true);
  });

  it('writes nothing when any question cannot be graded', async () => {
    const evaluate = jest
      .fn()
      .mockResolvedValueOnce(evaluation(4))
      .mockRejectedValueOnce(new Error('Invalid model response'));
    const { runner, attempts, adapter } = harness(evaluate);

    await runner.run(7);

    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
    expect(attempts[0].status).toBe(CanvasBatchAttemptStatus.Error);
    expect(adapter.putSubmissionComment).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an instructor grade exists',
      { existingGrade: { score: 2, comment: '' } },
    ],
    ['the grade is already posted', { postedAt: '2026-09-16T00:00:00Z' }],
  ])('neither grades nor writes when %s', async (_reason, options) => {
    const evaluate = jest.fn().mockResolvedValue(evaluation(4));
    const { runner, adapter } = harness(evaluate, options);

    await runner.run(7);

    expect(evaluate).not.toHaveBeenCalled();
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });
});
