import { ChatbotApiService } from '../../chatbot/chatbot-api.service';
import { ConfigService } from '@nestjs/config';
import {
  FINAL_GRADING_INSTRUCTION,
  MAX_GRADING_TEXT_LENGTH,
  type QuestionGradingSettings,
} from '@koh/common';
import { GradingConstraintError } from './grading-utils';
import { QuestionGradingService } from './question-grading.service';

function settings(
  overrides: Partial<QuestionGradingSettings> = {},
): QuestionGradingSettings {
  return {
    rubric: 'Award points for an accurate answer.',
    feedbackInstructions: 'Be concise.',
    scoreScale: { max: 10, step: 1 },
    checks: [],
    ...overrides,
  };
}

const validAnswer = (score = 8, comment = 'Good answer.') => ({
  answer: {
    score,
    comment,
    reasons: ['the rubric’s accuracy criterion was met'],
    human_review_reason: null,
  },
  model: 'test-model',
});

describe('QuestionGradingService (real chatbot adapter, mocked fetch boundary)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function harness() {
    const configService = new ConfigService({
      CHATBOT_API_URL: 'https://chatbot.test',
      CHATBOT_API_KEY: 'test-chatbot-api-key',
    });
    const fetchMock = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    global.fetch = fetchMock;
    return {
      fetchMock,
      service: new QuestionGradingService(new ChatbotApiService(configService)),
    };
  }

  const respond = (
    fetchMock: ReturnType<typeof harness>['fetchMock'],
    payload: unknown,
    status = 200,
  ) =>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  const evaluateArgs = {
    courseId: 12,
    questionText: 'Explain the idea.',
    gradingSettings: settings(),
    submission: 'A complete answer.',
  };

  it('rejects oversized batch answers without calling the model', async () => {
    const { service, fetchMock } = harness();
    await expect(
      service.evaluate({
        ...evaluateArgs,
        gradingMode: 'final',
        submission: 'a'.repeat(MAX_GRADING_TEXT_LENGTH + 1),
      }),
    ).rejects.toThrow('Grade this answer manually');
    expect(fetchMock).not.toHaveBeenCalled();
    respond(fetchMock, validAnswer());
    await expect(
      service.evaluate({
        ...evaluateArgs,
        gradingMode: 'final',
        submission: 'a'.repeat(MAX_GRADING_TEXT_LENGTH),
      }),
    ).resolves.toMatchObject({ score: 8 });
  });

  it('errors on an invalid grade after exactly one outbound call', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: {
        score: 11,
        comment: 'Too high.',
        reasons: ['invented reason'],
        human_review_reason: null,
      },
    });

    await expect(service.evaluate(evaluateArgs)).rejects.toThrow(
      GradingConstraintError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('short-circuits a blank submission without an outbound call', async () => {
    const { service, fetchMock } = harness();
    const result = await service.evaluate({
      ...evaluateArgs,
      submission: '   ',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      score: 0,
      comment: '',
      maxScore: 10,
      model: null,
      reasons: ['blank'],
      humanReviewReason: null,
      appliedRequirements: [
        'No answer was provided; the blank response scores 0 without an AI call.',
      ],
    });
  });

  it('sends the question context separately and rejects a score above the cap', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, validAnswer(2));

    await expect(
      service.evaluate({
        ...evaluateArgs,
        gradingSettings: settings({
          scoreScale: { max: 2, step: 0.5 },
          checks: [{ kind: 'minimum_sentences', minimum: 2, scoreCap: 1 }],
        }),
        submission: 'One sentence.',
      }),
    ).rejects.toThrow(/effective cap of 1/);
    const request = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );

    expect(request.query).toContain(JSON.stringify('One sentence.'));
    expect(request.query).not.toContain(evaluateArgs.questionText);
    expect(request.params.grading).toMatchObject({
      questionText: evaluateArgs.questionText,
      rubric: evaluateArgs.gradingSettings.rubric,
      scoreContract: expect.stringContaining(
        'Allowed scores: 0, 0.5, 1. Full rubric credit is 2. If no rubric criterion warrants a deduction, select 1.',
      ),
      capContract: 'Triggered automatic checks cap the score at 1.',
    });
    expect(request.params.grading.automaticChecks).toContain(
      'fewer than 2 sentences',
    );
  });

  it.each([
    {
      gradingMode: 'final' as const,
      finalInstruction: 'Frozen final instruction.',
      expected: 'Frozen final instruction.',
    },
    {
      gradingMode: 'final' as const,
      finalInstruction: undefined,
      expected: FINAL_GRADING_INSTRUCTION,
    },
    {
      gradingMode: undefined,
      finalInstruction: undefined,
      expected: undefined,
    },
  ])(
    'uses the final instruction in place of feedback instructions: %j',
    async ({ gradingMode, finalInstruction, expected }) => {
      const { service, fetchMock } = harness();
      respond(fetchMock, validAnswer());
      const result = await service.evaluate({
        ...evaluateArgs,
        gradingMode,
        finalInstruction,
      });
      const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(request.params.grading.feedbackInstructions).toBe(
        expected ?? evaluateArgs.gradingSettings.feedbackInstructions,
      );
      expect(result.gradingSnapshot.instruction).toBe(expected);
    },
  );

  it('propagates a human review reason from the model', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: {
        score: 5,
        comment: 'This is hard to judge.',
        reasons: ['the rubric can be read two ways'],
        human_review_reason:
          'The rubric does not say whether both steps are required.',
      },
    });

    const result = await service.evaluate(evaluateArgs);

    expect(result.humanReviewReason).toBe(
      'The rubric does not say whether both steps are required.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('snapshots settings before awaiting the chatbot', async () => {
    const { service, fetchMock } = harness();
    let resolveFetch: (value: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((res) => {
        resolveFetch = res;
      }),
    );
    const gradingSettings = settings();
    const evaluation = service.evaluate({
      ...evaluateArgs,
      gradingSettings,
    });

    gradingSettings.rubric = 'Mutated rubric.';
    resolveFetch(
      new Response(JSON.stringify(validAnswer(5, 'Okay.')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await evaluation;
    expect(result.score).toBe(5);
    expect(result.comment).toBe('Okay.');
    expect(result.model).toBe('test-model');
    expect(result.gradingSnapshot.gradingSettings.rubric).toBe(
      'Award points for an accurate answer.',
    );
  });
});
