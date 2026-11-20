import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSApiResponseStatus } from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { CanvasLMSAdapter } from './lmsIntegration.adapter';

const COURSE_ID = 42;
const BASE_URL = 'https://canvas.example.test';
const LOOKUP_UUID = '11111111-1111-4111-8111-111111111111';
const gradeUpdate = {
  quizId: 7,
  quizSubmissionId: 8,
  attempt: 1,
  questions: [{ questionId: 11, score: 2, comment: 'Feedback' }],
};

function adapter(
  apiKey: string | undefined = 'test-api-key',
): CanvasLMSAdapter {
  return new CanvasLMSAdapter(
    Object.assign(new LMSCourseIntegrationModel(), {
      apiCourseId: COURSE_ID,
      apiKey,
      apiKeyExpiry: null,
      accessTokenId: null,
      orgIntegration: Object.assign(new LMSOrganizationIntegrationModel(), {
        apiPlatform: 'Canvas',
        rootUrl: 'canvas.example.test',
        secure: true,
      }),
    }),
  );
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(
  handler: (url: URL, init?: RequestInit) => Response | Promise<Response>,
) {
  return jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input, init) =>
      handler(new URL(String(input)), init),
    );
}

describe('CanvasLMSAdapter Classic quiz grading', () => {
  afterEach(() => jest.restoreAllMocks());

  it('requires an instructor API token for batch reads and writes', async () => {
    const fetchMock = mockFetch(() => response({}));
    const oauthOnly = adapter('');
    await expect(oauthOnly.getClassicQuizCatalog()).rejects.toThrow(
      'instructor API token',
    );
    await expect(
      oauthOnly.getClassicAttemptSnapshots({ quizId: 7, assignmentId: 700 }),
    ).rejects.toThrow('instructor API token');
    await expect(
      oauthOnly.putClassicAttemptGrades(gradeUpdate),
    ).rejects.toThrow('instructor API token');
    await expect(
      oauthOnly.putSubmissionComment({
        assignmentId: 700,
        userId: 5,
        text: 'Review required',
      }),
    ).rejects.toThrow('instructor API token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'rejected', LMSApiResponseStatus.Unauthorized],
    [403, 'rejected', LMSApiResponseStatus.Forbidden],
    [408, 'unknown', 'Upstream failed'],
    [500, 'unknown', 'Upstream failed'],
    [null, 'unknown', 'Socket closed'],
  ])(
    'classifies failed writes without retrying (%s)',
    async (status, outcome, message) => {
      const fetchMock = mockFetch(() => {
        if (status === null) throw new Error('Socket closed');
        return new Response('Upstream failed', { status });
      });
      expect(
        await adapter().putClassicAttemptGrades(gradeUpdate),
      ).toMatchObject({
        outcome,
        message,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    [401, LMSApiResponseStatus.Unauthorized],
    [403, LMSApiResponseStatus.Forbidden],
    [200, LMSApiResponseStatus.Error],
  ])(
    'reports denied or malformed catalog reads (%s)',
    async (status, expected) => {
      mockFetch(
        () =>
          new Response(JSON.stringify({ error: 'Not a quiz list' }), {
            status,
          }),
      );
      expect((await adapter().getClassicQuizCatalog()).status).toBe(expected);
    },
  );

  it('maps embedded essay questions from a selected quiz', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          { id: 7, title: 'Essay quiz', published: true, assignment_id: 700 },
          { id: 8, title: 'Another quiz', published: true, assignment_id: 701 },
        ]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([
          { id: 700, post_manually: true },
          { id: 701, post_manually: true },
        ]);
      }
      if (url.pathname.endsWith('/quizzes/7/questions')) {
        return response([
          {
            id: 11,
            position: 1,
            question_text: `Explain why<iframe src="/retrieve?resource_link_lookup_uuid=${LOOKUP_UUID}"></iframe>`,
            question_type: 'essay_question',
            points_possible: 5,
          },
        ]);
      }
      if (url.pathname.includes('/lti_resource_links/')) {
        return response({
          lookup_uuid: LOOKUP_UUID,
          custom: { helpme_question_id: '101' },
        });
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog(7);

    expect(result.status).toBe(LMSApiResponseStatus.Success);
    expect(result.quizzes).toHaveLength(1);
    expect(result.quizzes[0]).toMatchObject({
      quizId: 7,
      assignmentId: 700,
      postManually: true,
      essayQuestions: [
        expect.objectContaining({
          id: 11,
          text: 'Explain why',
          mapping: {
            status: 'detected',
            lookupUuid: LOOKUP_UUID,
            embeddableQuestionId: 101,
          },
        }),
      ],
    });
  });

  it('reads completed essay attempts', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes/7/submissions')) {
        return response({
          quiz_submissions: [
            {
              id: 1002,
              quiz_id: 7,
              user_id: 5,
              attempt: 1,
              workflow_state: 'complete',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/assignments/700/submissions')) {
        return response([
          {
            user_id: 5,
            attempt: 1,
            excused: false,
            posted_at: null,
            submission_history: [
              {
                attempt: 1,
                submission_data: [
                  {
                    question_id: 11,
                    text: '<h2>My Indigenous goals</h2><table><tr><th>strength</th></tr><tr><td>listening</td></tr></table>',
                    points: 0,
                    correct: 'undefined',
                    comment: null,
                  },
                ],
              },
            ],
          },
        ]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicAttemptSnapshots({
      quizId: 7,
      assignmentId: 700,
    });

    expect(result.snapshot?.attempts).toEqual([
      {
        quizSubmissionId: 1002,
        userId: 5,
        attempt: 1,
        postedAt: null,
        excused: false,
        readable: true,
        answers: [
          {
            questionId: 11,
            text: 'My Indigenous goals\n\nstrength\nlistening',
            points: null,
            comment: null,
          },
        ],
      },
    ]);
  });

  it('sends every question grade in one Canvas request', async () => {
    const fetchMock = mockFetch(() => response({}));

    await adapter().putClassicAttemptGrades({
      quizId: 7,
      quizSubmissionId: 1002,
      attempt: 1,
      questions: [
        { questionId: 11, score: 4, comment: 'Good work.' },
        { questionId: 12, score: 0, comment: 'No answer was submitted.' },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `${BASE_URL}/api/v1/courses/${COURSE_ID}/quizzes/7/submissions/1002`,
    );
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      quiz_submissions: [
        {
          attempt: 1,
          questions: {
            '11': { score: 4, comment: 'Good work.' },
            '12': { score: 0, comment: 'No answer was submitted.' },
          },
        },
      ],
    });
  });
});
