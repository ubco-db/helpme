import { ConfigService } from '@nestjs/config';
import { ChatbotApiService } from './chatbot-api.service';

describe('ChatbotApiService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
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
      reasons: ['both required examples were included'],
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

  it('passes a malformed model answer through the envelope for the grading boundary to validate', async () => {
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
            reasons: ['both required examples were included'],
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
        reasons: ['both required examples were included'],
        needs_human_review: false,
      },
      model: 'test-model',
    });
  });

  it('aborts a hung feedback request at the host deadline and fails without retrying', async () => {
    const configService = new ConfigService({
      CHATBOT_API_URL: 'https://chatbot.test',
      CHATBOT_API_KEY: 'test-chatbot-api-key',
    });
    const service = new ChatbotApiService(configService);

    // Fake the clock: the service requests a 65s deadline (transport grace
    // above the chatbot's 60s retry budget), which we substitute with a 10ms
    // deadline so the real abort path runs quickly.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = jest
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => realTimeout(10));

    const mockFetch = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();
    mockFetch.mockImplementation(
      (_url: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason),
          );
        }),
    );
    global.fetch = mockFetch;

    await expect(
      service.queryChatbotForCourse('user prompt', 42, 'feedback', {
        systemPrompt: 'system prompt',
      }),
    ).rejects.toThrow('Failed to connect to chatbot service');

    expect(timeoutSpy).toHaveBeenCalledWith(65000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
