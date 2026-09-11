import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import { ConfigService } from '@nestjs/config';
import type { QuestionGradingSettings, QuizContext } from '@koh/common';
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

  const parseFeedbackRequest = (
    fetchMock: ReturnType<typeof harness>['fetchMock'],
  ): {
    query: string;
    type: string;
    courseId: number;
    params: { systemPrompt: string };
  } => JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

  it('makes exactly one outbound feedback call and returns a question-owned snapshot', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, validAnswer());
    const quizContext: QuizContext = {
      id: 4,
      title: 'Quiz',
      objective: 'Apply the ideas.',
      background: 'Read chapter one.',
    };
    const gradingSettings = settings();
    const result = await service.evaluate({
      ...evaluateArgs,
      gradingSettings,
      quizContext,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = parseFeedbackRequest(fetchMock);
    expect(requestBody).toMatchObject({
      query: expect.stringContaining('Student answer'),
      type: 'feedback',
      courseId: 12,
      params: {
        systemPrompt: expect.stringContaining('Apply the ideas.'),
      },
    });
    expect(result).toMatchObject({
      score: 8,
      comment: 'Good answer.',
      appliedRequirements: [],
      maxScore: 10,
      model: 'test-model',
      reasons: ['the rubric’s accuracy criterion was met'],
      needsHumanReview: false,
    });
    expect(result.gradingSnapshot).toEqual({
      version: 1,
      questionText: 'Explain the idea.',
      gradingSettings,
      quizContext,
    });
  });

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

  it('sends triggered checks and their cap before the AI call', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: {
        score: 1,
        comment: 'Brief.',
        reasons: ['below the rubric length'],
        needs_human_review: false,
      },
      model: 'test-model',
    });
    const gradingSettings = settings({
      checks: [{ kind: 'minimum_sentences', minimum: 3, scoreCap: 2 }],
    });
    const result = await service.evaluate({
      ...evaluateArgs,
      gradingSettings,
      submission: 'One. Two.',
    });

    const requestBody = parseFeedbackRequest(fetchMock);
    expect(requestBody.query).toContain('"sentence_count":2');
    expect(requestBody.query).toContain('"automatic_checks_triggered"');
    expect(requestBody.params.systemPrompt).toContain('effective cap of 2');
    expect(result.score).toBe(1);
  });

  it('propagates a transport failure immediately', async () => {
    const { service, fetchMock } = harness();
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(service.evaluate(evaluateArgs)).rejects.toThrow(
      'Failed to connect to chatbot service',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates an HTTP failure from the adapter after exactly one call', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, { error: 'chatbot exploded' }, 500);

    await expect(service.evaluate(evaluateArgs)).rejects.toThrow(
      'chatbot exploded',
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
    const quizContext: QuizContext = {
      id: 4,
      title: 'Quiz',
      objective: 'Original objective.',
      background: '',
    };
    const evaluation = service.evaluate({
      ...evaluateArgs,
      gradingSettings,
      quizContext,
    });

    gradingSettings.rubric = 'Mutated rubric.';
    quizContext.objective = 'Mutated objective.';
    resolveFetch(
      new Response(JSON.stringify(validAnswer(5, 'Okay.')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await evaluation;
    expect(result.gradingSnapshot.gradingSettings.rubric).toBe(
      'Award points for an accurate answer.',
    );
    expect(result.gradingSnapshot.quizContext?.objective).toBe(
      'Original objective.',
    );
  });
});
