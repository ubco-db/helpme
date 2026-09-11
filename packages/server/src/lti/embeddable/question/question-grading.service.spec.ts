import { ChatbotApiService } from '../../../chatbot/chatbot-api.service';
import type { FeedbackQueryResult } from '../../../chatbot/chatbot-api.service';
import { ConfigService } from '@nestjs/config';
import type { QuestionGradingSettings, QuizContext } from '@koh/common';
import { GradingConstraintError } from './grading';
import { QuestionGradingService } from './question-grading.service';

function settings(overrides: Partial<QuestionGradingSettings> = {}) {
  const value: QuestionGradingSettings = {
    rubric: 'Award points for an accurate answer.',
    feedbackInstructions: 'Be concise.',
    scoreScale: { kind: 'range', max: 10, step: 1 },
    checks: [],
  };
  return { ...value, ...overrides };
}

function chatbot(responses: FeedbackQueryResult[]) {
  return {
    queryChatbotForCourse: jest
      .fn()
      .mockImplementation(() => Promise.resolve(responses.shift())),
  } as unknown as ChatbotApiService;
}

const validAnswer = (
  score = 8,
  comment = 'Good answer.',
): FeedbackQueryResult => ({
  answer: {
    score,
    comment,
    reasons: ['the rubric’s accuracy criterion was met'],
    needs_human_review: false,
  },
  model: 'test-model',
});

describe('QuestionGradingService', () => {
  it('makes exactly one feedback call and returns a question-owned snapshot', async () => {
    const api = chatbot([validAnswer()]);
    const service = new QuestionGradingService(api);
    const quizContext: QuizContext = {
      id: 4,
      title: 'Quiz',
      objective: 'Apply the ideas.',
      background: 'Read chapter one.',
    };
    const gradingSettings = settings();
    const result = await service.evaluate({
      courseId: 12,
      questionText: 'Explain the idea.',
      gradingSettings,
      quizContext,
      submission: 'A complete answer.',
    });

    expect(api.queryChatbotForCourse).toHaveBeenCalledTimes(1);
    expect(api.queryChatbotForCourse).toHaveBeenCalledWith(
      expect.stringContaining('Student answer'),
      12,
      'feedback',
      expect.objectContaining({
        systemPrompt: expect.stringContaining('Apply the ideas.'),
      }),
    );
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

  it('errors on an invalid grade and makes no second call', async () => {
    const api = chatbot([
      {
        answer: {
          score: 11,
          comment: 'Too high.',
          reasons: ['invented reason'],
          needs_human_review: false,
        },
      },
    ]);

    await expect(
      new QuestionGradingService(api).evaluate({
        courseId: 12,
        questionText: 'Explain the idea.',
        gradingSettings: settings(),
        submission: 'A complete answer.',
      }),
    ).rejects.toThrow(GradingConstraintError);
    expect(api.queryChatbotForCourse).toHaveBeenCalledTimes(1);
  });

  it('short-circuits a blank submission without calling the model', async () => {
    const api = chatbot([validAnswer()]);
    const result = await new QuestionGradingService(api).evaluate({
      courseId: 12,
      questionText: 'Explain the idea.',
      gradingSettings: settings(),
      submission: '  ',
    });

    expect(api.queryChatbotForCourse).not.toHaveBeenCalled();
    expect(result.score).toBe(0);
    expect(result.comment).toBe('');
    expect(result.maxScore).toBe(10);
    expect(result.model).toBeNull();
    expect(result.reasons).toEqual(['blank']);
    expect(result.needsHumanReview).toBe(false);
    expect(result.appliedRequirements).toEqual([
      'No answer was provided; the blank response scores 0 without an AI call.',
    ]);
  });

  it('sends triggered checks and their cap before the AI call', async () => {
    const api = chatbot([
      {
        answer: {
          score: 1,
          comment: 'Brief.',
          reasons: ['below the rubric length'],
          needs_human_review: false,
        },
        model: 'test-model',
      },
    ]);
    const gradingSettings = settings({
      checks: [{ kind: 'minimum_sentences', minimum: 3, scoreCap: 2 }],
    });
    const result = await new QuestionGradingService(api).evaluate({
      courseId: 12,
      questionText: 'Explain the idea.',
      gradingSettings,
      submission: 'One. Two.',
    });

    const call = (api.queryChatbotForCourse as jest.Mock).mock.calls[0];
    const userPrompt: string = call[0];
    expect(userPrompt).toContain('"sentence_count":2');
    expect(userPrompt).toContain('"automatic_checks_triggered"');
    expect(call[3].systemPrompt).toContain('effective cap of 2');
    expect(result.score).toBe(1);
  });

  it('propagates transport failures immediately', async () => {
    const api = {
      queryChatbotForCourse: jest
        .fn()
        .mockRejectedValue(new Error('Failed to connect to chatbot service')),
    } as unknown as ChatbotApiService;

    await expect(
      new QuestionGradingService(api).evaluate({
        courseId: 12,
        questionText: 'Explain the idea.',
        gradingSettings: settings(),
        submission: 'A complete answer.',
      }),
    ).rejects.toThrow('Failed to connect to chatbot service');
    expect(api.queryChatbotForCourse).toHaveBeenCalledTimes(1);
  });

  it('snapshots settings before awaiting the chatbot', async () => {
    let resolve: (value: FeedbackQueryResult) => void = () => undefined;
    const response = new Promise<FeedbackQueryResult>((res) => {
      resolve = res;
    });
    const api = {
      queryChatbotForCourse: jest.fn().mockReturnValue(response),
    } as unknown as ChatbotApiService;
    const gradingSettings = settings();
    const quizContext: QuizContext = {
      id: 4,
      title: 'Quiz',
      objective: 'Original objective.',
      background: '',
    };
    const evaluation = new QuestionGradingService(api).evaluate({
      courseId: 12,
      questionText: 'Question',
      gradingSettings,
      quizContext,
      submission: 'Answer.',
    });

    gradingSettings.rubric = 'Mutated rubric.';
    quizContext.objective = 'Mutated objective.';
    resolve(validAnswer(5, 'Okay.'));

    const result = await evaluation;
    expect(result.gradingSnapshot.gradingSettings.rubric).toBe(
      'Award points for an accurate answer.',
    );
    expect(result.gradingSnapshot.quizContext?.objective).toBe(
      'Original objective.',
    );
  });
});

describe('QuestionGradingService through the real adapter (mocked HTTP boundary)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const evaluateArgs = {
    courseId: 12,
    questionText: 'Explain the idea.',
    gradingSettings: settings(),
    submission: 'A complete answer.',
  };

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

  it('grades once through the adapter and keeps the model provenance', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: {
        score: 8,
        comment: 'Good.',
        reasons: ['complete'],
        needs_human_review: false,
      },
      model: 'm',
    });

    const result = await service.evaluate(evaluateArgs);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.score).toBe(8);
    expect(result.model).toBe('m');
  });

  it('errors after exactly 1 call when the model answer is malformed, leaving nothing to persist', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, {
      answer: { score: 'still not a number', comment: 'No.' },
      model: 'test-model',
    });

    await expect(service.evaluate(evaluateArgs)).rejects.toThrow(
      GradingConstraintError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('propagates an HTTP failure from the adapter after exactly 1 call', async () => {
    const { service, fetchMock } = harness();
    respond(fetchMock, { error: 'chatbot exploded' }, 500);

    await expect(service.evaluate(evaluateArgs)).rejects.toThrow(
      'chatbot exploded',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
