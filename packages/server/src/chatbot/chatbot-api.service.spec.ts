import { ConfigService } from '@nestjs/config';
import { ChatbotApiService } from './chatbot-api.service';

describe('ChatbotApiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns a valid structured feedback response', async () => {
    const testApiUrl = 'https://chatbot.test';
    const configService = new ConfigService({
      CHATBOT_API_URL: testApiUrl,
      CHATBOT_API_KEY: 'test-chatbot-api-key',
    });
    const service = new ChatbotApiService(configService);

    const expectedAnswer = {
      score: 2,
      comment: 'Thoughtful reflection meeting the criteria.',
      reasons: ['meets_requirements'],
      needs_human_review: false,
    };

    const mockFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          answer: expectedAnswer,
          model: 'test-model',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    global.fetch = mockFetch;

    const result = await service.queryChatbotForCourse(
      'user prompt',
      42,
      'feedback',
      { systemPrompt: 'system prompt' },
    );

    expect(result).toEqual({
      answer: expectedAnswer,
      model: 'test-model',
    });

    const [requestUrl, requestInit] = mockFetch.mock.calls[0];
    expect(String(requestUrl)).toBe(`${testApiUrl}/chatbot/query`);
    const requestBody: unknown = JSON.parse(String(requestInit?.body));
    expect(requestBody).toMatchObject({
      query: 'user prompt',
      type: 'feedback',
      courseId: 42,
      params: { systemPrompt: 'system prompt' },
    });
  });

  it('rejects a malformed response envelope at the runtime boundary', async () => {
    const configService = new ConfigService({
      CHATBOT_API_URL: 'https://chatbot.test',
      CHATBOT_API_KEY: 'test-chatbot-api-key',
    });
    const service = new ChatbotApiService(configService);

    const mockFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify('not an envelope'), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
    global.fetch = mockFetch;

    await expect(
      service.queryChatbotForCourse('user prompt', 42, 'feedback', {
        systemPrompt: 'system prompt',
      }),
    ).rejects.toThrow();
  });

  it('passes a malformed model answer through the envelope for the grading boundary to validate and retry', async () => {
    const configService = new ConfigService({
      CHATBOT_API_URL: 'https://chatbot.test',
      CHATBOT_API_KEY: 'test-chatbot-api-key',
    });
    const service = new ChatbotApiService(configService);

    const mockFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          answer: {
            score: 'high',
            comment: 'Thoughtful reflection meeting the criteria.',
            reasons: ['meets_requirements'],
            needs_human_review: false,
          },
          model: 'test-model',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );
    global.fetch = mockFetch;

    const result = await service.queryChatbotForCourse(
      'user prompt',
      42,
      'feedback',
      { systemPrompt: 'system prompt' },
    );

    expect(result).toEqual({
      answer: {
        score: 'high',
        comment: 'Thoughtful reflection meeting the criteria.',
        reasons: ['meets_requirements'],
        needs_human_review: false,
      },
      model: 'test-model',
    });
  });
});
