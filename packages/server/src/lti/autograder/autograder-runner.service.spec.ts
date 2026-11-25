import {
  AutograderAttemptStatus,
  AutograderQuestionStatus,
  AutograderRunStatus,
  BLANK_ANSWER_COMMENT,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  type AutograderQuestionSnapshot,
  type QuestionGradingSettings,
} from '@koh/common';
import type { LMSClassicAttempt } from '../../lmsIntegration/lmsIntegration.adapter';
import { AutograderAttemptModel } from './autograder-attempt.entity';
import { AutograderService } from './autograder.service';
import { AutograderRunnerService } from './autograder-runner.service';
import { AutograderRunModel } from './autograder-run.entity';
import type { AutograderStore } from './autograder.store';

const gradingSettings: QuestionGradingSettings = {
  rubric: 'Award points for an accurate answer.',
  feedbackInstructions: 'Be concise.',
  scoreScale: { max: 5, step: 1 },
  checks: [],
};

function question(id: number, position: number): AutograderQuestionSnapshot {
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

function run(overrides: Partial<AutograderRunModel> = {}): AutograderRunModel {
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
    questionSnapshots: questions,
    error: null,
    completedAt: null,
    ...overrides,
  });
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
    readable?: boolean;
    excused?: boolean;
    run?: Partial<AutograderRunModel>;
  } = {},
) {
  const runModel = run(options.run);
  const discoveredAttempt = canvasAttempt();
  discoveredAttempt.postedAt = options.postedAt ?? null;
  discoveredAttempt.readable = options.readable ?? true;
  discoveredAttempt.excused = options.excused ?? false;
  if (options.existingGrade) {
    discoveredAttempt.answers[0].points = options.existingGrade.score;
    discoveredAttempt.answers[0].comment = options.existingGrade.comment;
  }
  const attempts: AutograderAttemptModel[] = [];
  const store = {
    withRunLock: jest.fn(async (_runId: number, work: () => Promise<void>) =>
      work(),
    ),
    findRun: jest.fn(async () => structuredClone(runModel)),
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
    createAttempt: jest.fn(async (data: Partial<AutograderAttemptModel>) => {
      const created = Object.assign(new AutograderAttemptModel(), {
        id: 1,
        createdAt: new Date(),
        ...data,
      });
      attempts.push(structuredClone(created));
      return created;
    }),
    saveAttempt: jest.fn(async (item: AutograderAttemptModel) => {
      attempts[attempts.findIndex((saved) => saved.id === item.id)] =
        structuredClone(item);
      return item;
    }),
    isRunCancelled: jest.fn(
      async () => runModel.status === AutograderRunStatus.Cancelled,
    ),
    completeRun: jest.fn(async () => {
      if (runModel.status !== AutograderRunStatus.Running) {
        return false;
      }
      runModel.status = AutograderRunStatus.Completed;
      runModel.completedAt = new Date();
      return true;
    }),
    saveRun: jest.fn(async (item: AutograderRunModel) =>
      Object.assign(runModel, item),
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
  const runner = new AutograderRunnerService(
    store as unknown as AutograderStore,
    { getAdapter } as never,
    { evaluate } as never,
  );
  return { runner, attempts, adapter, runModel, store, getAdapter };
}

function reportService(store: AutograderStore): AutograderService {
  return new AutograderService({} as never, store, {} as never);
}

describe('AutograderRunnerService', () => {
  it('does not show the recovery marker as a failure during an active write', async () => {
    const { runner, adapter, store } = harness(
      jest.fn().mockResolvedValue(evaluation(4)),
    );
    adapter.putClassicAttemptGrades.mockImplementationOnce(async () => {
      const report = await reportService(
        store as unknown as AutograderStore,
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
      const { runner, adapter, attempts, runModel, store } = harness(evaluate);
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
      expect(attempts[0].status).toBe(AutograderAttemptStatus.Writing);
      store.saveAttempt.mockImplementation(save);
      runModel.status = AutograderRunStatus.Running;
      await runner.run(7);

      expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
      expect(adapter.putSubmissionComment).toHaveBeenCalledTimes(
        stage === 'grade' ? 0 : 1,
      );
      expect(attempts[0].status).toBe(AutograderAttemptStatus.Error);
      expect(attempts[0].error).toContain('SpeedGrader');
      expect(attempts[0].error).toContain('unknown');
      const report = await reportService(
        store as unknown as AutograderStore,
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
      if (attempt.status === AutograderAttemptStatus.Writing) {
        throw new Error('Database unavailable');
      }
      return save(attempt);
    });
    await runner.run(7);
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('reports a discovery failure with recovery steps', async () => {
    const status = LMSApiResponseStatus.Unauthorized;
    const { runner, adapter, runModel, store } = harness(jest.fn());
    adapter.getClassicAttemptSnapshots.mockResolvedValue({ status });
    await runner.run(7);
    expect(runModel.status).toBe(AutograderRunStatus.Failed);
    expect(runModel.error).toContain(status);
    expect(runModel.error).toContain('start a new run');
    const report = await reportService(
      store as unknown as AutograderStore,
    ).getReport(runModel.courseId, runModel.id);
    expect(report.run).toMatchObject({
      status: AutograderRunStatus.Failed,
      error: expect.stringContaining(status),
    });
    expect(report.run.completedAt).not.toBeNull();
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('persists transport initialization failure', async () => {
    const { runner, getAdapter, runModel } = harness(jest.fn());
    getAdapter.mockRejectedValue(new Error('Connection unavailable'));
    await runner.run(7);
    expect(runModel.status).toBe(AutograderRunStatus.Failed);
    expect(runModel.error).toContain('Connection unavailable');
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
      expect(attempts[0].status).toBe(AutograderAttemptStatus.Error);
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
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Prefilled);
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
      AutograderQuestionStatus.Written,
    );
    expect(attempts[0].error).toContain('review comment was not added');
    expect(attempts[0].error).toContain('Do not regrade');
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Error);
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
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Prefilled);
    expect(
      attempts[0].questions.every(
        (item) => item.status === AutograderQuestionStatus.Written,
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
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Error);
    expect(adapter.putSubmissionComment).not.toHaveBeenCalled();
  });

  it('skips only the question that already has an instructor grade', async () => {
    const evaluate = jest.fn().mockResolvedValue(evaluation(3));
    const { runner, adapter, attempts } = harness(evaluate, {
      existingGrade: { score: 2, comment: '' },
    });

    await runner.run(7);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledWith({
      quizId: 55,
      quizSubmissionId: 500,
      attempt: 1,
      questions: [{ questionId: 102, score: 3, comment: 'Good answer.' }],
    });
    expect(attempts[0].questions[0].status).toBe(
      AutograderQuestionStatus.Skipped,
    );
    expect(attempts[0].questions[1].status).toBe(
      AutograderQuestionStatus.Written,
    );
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Prefilled);
  });

  it('regrades existing grades when the run allows it', async () => {
    const evaluate = jest
      .fn()
      .mockResolvedValueOnce(evaluation(4))
      .mockResolvedValueOnce(evaluation(3));
    const { runner, adapter, attempts } = harness(evaluate, {
      existingGrade: { score: 2, comment: 'Old comment' },
      run: { regradeSubmissions: true },
    });

    await runner.run(7);

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledWith({
      quizId: 55,
      quizSubmissionId: 500,
      attempt: 1,
      questions: [
        { questionId: 101, score: 4, comment: 'Good answer.' },
        { questionId: 102, score: 3, comment: 'Good answer.' },
      ],
    });
    expect(
      attempts[0].questions.every(
        (item) => item.status === AutograderQuestionStatus.Written,
      ),
    ).toBe(true);
  });

  it('does not discover a posted attempt unless the run allows posted grades', async () => {
    const evaluate = jest.fn().mockResolvedValue(evaluation(4));
    const { runner, adapter, attempts } = harness(evaluate, {
      postedAt: '2026-09-16T00:00:00Z',
      run: { regradeSubmissions: true, includePostedGrades: false },
    });

    await runner.run(7);

    expect(attempts).toHaveLength(0);
    expect(evaluate).not.toHaveBeenCalled();
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('reports an unreadable attempt without writing anything', async () => {
    const { runner, adapter, attempts } = harness(jest.fn(), {
      readable: false,
    });

    await runner.run(7);

    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Error);
    expect(attempts[0].error).toContain('submission history');
  });

  it('stops before the next attempt when the run is cancelled', async () => {
    const { runner, adapter, attempts, runModel, store } = harness(
      jest.fn().mockResolvedValue(evaluation(4)),
    );
    // Not cancelled after discovery, cancelled before the first attempt.
    store.isRunCancelled
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(async () => {
        runModel.status = AutograderRunStatus.Cancelled;
        return true;
      });

    await runner.run(7);

    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe(AutograderAttemptStatus.Pending);
    expect(runModel.status).toBe(AutograderRunStatus.Cancelled);
  });

  it('does not overwrite a cancellation that arrives during a write', async () => {
    const { runner, adapter, runModel } = harness(
      jest.fn().mockResolvedValue(evaluation(4)),
    );
    adapter.putClassicAttemptGrades.mockImplementationOnce(async () => {
      runModel.status = AutograderRunStatus.Cancelled;
      return { outcome: 'success' };
    });

    await runner.run(7);

    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
    expect(runModel.status).toBe(AutograderRunStatus.Cancelled);
  });

  it('never discovers an excused attempt', async () => {
    const { runner, adapter, attempts } = harness(jest.fn(), {
      excused: true,
    });

    await runner.run(7);

    expect(attempts).toHaveLength(0);
    expect(adapter.putClassicAttemptGrades).not.toHaveBeenCalled();
  });

  it('regrades posted attempts when the run includes them', async () => {
    const evaluate = jest
      .fn()
      .mockResolvedValueOnce(evaluation(4))
      .mockResolvedValueOnce(evaluation(3));
    const { runner, adapter, attempts } = harness(evaluate, {
      postedAt: '2026-09-16T00:00:00Z',
      existingGrade: { score: 2, comment: 'Posted comment' },
      run: { regradeSubmissions: true, includePostedGrades: true },
    });

    await runner.run(7);

    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(attempts).toHaveLength(1);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledTimes(1);
  });

  it('writes a deterministic blank answer without calling the model', async () => {
    const evaluate = jest.fn().mockResolvedValue(evaluation(3));
    const { runner, adapter } = harness(evaluate);
    adapter.getClassicAttemptSnapshots.mockResolvedValue({
      status: LMSApiResponseStatus.Success,
      snapshot: {
        quizId: 55,
        attempts: [
          {
            ...canvasAttempt(),
            answers: [
              { questionId: 101, text: '   ', points: null, comment: null },
              {
                questionId: 102,
                text: 'Second answer.',
                points: null,
                comment: null,
              },
            ],
          },
        ],
      },
    });

    await runner.run(7);

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(adapter.putClassicAttemptGrades).toHaveBeenCalledWith({
      quizId: 55,
      quizSubmissionId: 500,
      attempt: 1,
      questions: [
        { questionId: 101, score: 0, comment: BLANK_ANSWER_COMMENT },
        { questionId: 102, score: 3, comment: 'Good answer.' },
      ],
    });
  });
});
