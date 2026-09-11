import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import { ConfigService } from '@nestjs/config';
import type { QuestionGradingSettings } from '@koh/common';
import { GradingConstraintError } from './grading';
import { QuestionGradingService } from './question-grading.service';

function settings(
  overrides: Partial<QuestionGradingSettings> = {},
): QuestionGradingSettings {
  return {
    rubric: 'Award points for an accurate answer.',
    feedbackInstructions: 'Be concise.',
    scoreScale: { kind: 'range', max: 10, step: 1 },
    checks: [],
    ...overrides,
  };
}

const validAnswer = (score = 8, comment = 'Good answer.') => ({
  answer: {
    score,
    comment,
    reasons: ['the rubric’s accuracy criterion was met'],
    needs_human_review: false,
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

  it('errors on an invalid grade after exactly one outbound call', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: {
        score: 11,
        comment: 'Too high.',
        reasons: ['invented reason'],
        needs_human_review: false,
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
      needsHumanReview: false,
      appliedRequirements: [
        'No answer was provided; the blank response scores 0 without an AI call.',
      ],
    });
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
