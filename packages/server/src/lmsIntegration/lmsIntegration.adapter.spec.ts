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
  options: {
    noApiKey?: boolean;
    accessTokenId?: number | null;
  } = {},
): CanvasLMSAdapter {
  return new CanvasLMSAdapter(
    Object.assign(new LMSCourseIntegrationModel(), {
      apiCourseId: COURSE_ID,
      apiKey: options.noApiKey ? undefined : 'test-api-key',
      apiKeyExpiry: null,
      accessTokenId: options.accessTokenId ?? null,
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

  it('reports a missing access token instead of silently failing', async () => {
    const fetchMock = mockFetch(() => response({}));
    const noAuth = adapter({ noApiKey: true, accessTokenId: null });

    await expect(noAuth.getClassicQuizCatalog()).rejects.toThrow(
      'No access token found for course',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('authorizes reads and writes with the course Access Token', async () => {
    const withToken = adapter({ noApiKey: true, accessTokenId: 1 });
    jest
      .spyOn(withToken, 'getAuthorization')
      .mockResolvedValue('Bearer access-token');
    const fetchMock = mockFetch((url) =>
      url.pathname.endsWith('/quizzes') || url.pathname.endsWith('/assignments')
        ? response([])
        : response({}),
    );

    await withToken.getClassicQuizCatalog();
    await withToken.putClassicAttemptGrades(gradeUpdate);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('authorization')).toBe(
        'Bearer access-token',
      );
    }
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
      const result = await adapter().getClassicQuizCatalog();
      expect(result.status).toBe(expected);
      if (expected === LMSApiResponseStatus.Error) {
        expect(result.message).toContain('expected a list');
      }
    },
  );

  it('reports a malformed quiz with a user-visible message', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([{ title: 'Missing id' }]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog();

    expect(result.status).toBe(LMSApiResponseStatus.Error);
    expect(result.message).toContain('unexpected quiz at position 1');
    expect(result.message).toContain('id');
  });

  it('lists a practice quiz with a blocking reason instead of dropping it', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          {
            id: 7,
            title: 'Practice quiz',
            published: true,
            assignment_id: null,
          },
        ]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog(7);

    expect(result.status).toBe(LMSApiResponseStatus.Success);
    expect(result.quizzes).toHaveLength(1);
    expect(result.quizzes[0]).toMatchObject({
      quizId: 7,
      assignmentId: null,
      speedGraderUrl: null,
      postManually: false,
      blockingReason: expect.stringContaining('practice quiz'),
    });
  });

  it('explains a quiz whose assignment Canvas did not return', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          { id: 9, title: 'Quiz', published: true, assignment_id: 999 },
        ]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog(9);

    expect(result.quizzes[0].blockingReason).toContain(
      'did not return the assignment',
    );
  });

  it('lists an unpublished quiz with a blocking reason', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          {
            id: 8,
            title: 'Draft quiz',
            published: false,
            assignment_id: 701,
          },
        ]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([{ id: 701, post_manually: true }]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog(8);

    expect(result.quizzes[0].blockingReason).toContain('not published');
    expect(result.quizzes[0].postManually).toBe(true);
  });

  it('maps embedded essay questions from a selected quiz', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          { id: 7, title: 'Essay quiz', published: true, assignment_id: 700 },
          {
            id: 8,
            title: 'Another quiz',
            published: true,
            assignment_id: 701,
          },
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
      blockingReason: null,
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

  it('explains a question that does not contain a HelpMe embed', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes')) {
        return response([
          { id: 7, title: 'Essay quiz', published: true, assignment_id: 700 },
        ]);
      }
      if (url.pathname.endsWith('/assignments')) {
        return response([{ id: 700, post_manually: true }]);
      }
      if (url.pathname.endsWith('/quizzes/7/questions')) {
        return response([
          {
            id: 11,
            position: 1,
            question_text: 'No embed here',
            question_type: 'essay_question',
            points_possible: 5,
          },
        ]);
      }
      throw new Error(`Unexpected Canvas request: ${url}`);
    });

    const result = await adapter().getClassicQuizCatalog(7);

    expect(result.quizzes[0].essayQuestions[0].mapping).toMatchObject({
      status: 'error',
      message: expect.stringContaining('Apps → HelpMe'),
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
                  // Non-essay and malformed entries must be skipped without
                  // making the whole attempt unreadable.
                  { question_id: 12, points: 0, correct: 'undefined' },
                  { question_id: 13, text: '<p>Bad score</p>', points: 'n/a' },
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

  it.each([
    ['no submission data', { user_id: 5, attempt: 1 }],
    [
      'an empty submission history',
      { user_id: 5, attempt: 1, submission_history: [] },
    ],
  ])(
    'marks an attempt unreadable when Canvas returns %s',
    async (_label, assignmentSubmission) => {
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
          return response([assignmentSubmission]);
        }
        throw new Error(`Unexpected Canvas request: ${url}`);
      });

      const result = await adapter().getClassicAttemptSnapshots({
        quizId: 7,
        assignmentId: 700,
      });

      expect(result.snapshot?.attempts).toEqual([
        expect.objectContaining({ quizSubmissionId: 1002, readable: false }),
      ]);
    },
  );

  it('excludes an attempt that Canvas has not finished', async () => {
    mockFetch((url) => {
      if (url.pathname.endsWith('/quizzes/7/submissions')) {
        return response({
          quiz_submissions: [
            {
              id: 1002,
              quiz_id: 7,
              user_id: 5,
              attempt: 1,
              workflow_state: 'untaken',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/assignments/700/submissions')) {
        return response([
          {
            user_id: 5,
            attempt: 1,
            submission_history: [
              {
                attempt: 1,
                workflow_state: null,
                submission_data: [],
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

    expect(result.snapshot?.attempts).toEqual([]);
  });

  it('adds a submission comment without posting a grade', async () => {
    const fetchMock = mockFetch(() => response({}));

    const result = await adapter().putSubmissionComment({
      assignmentId: 700,
      userId: 5,
      text: 'HUMAN REVIEW REQUIRED',
    });

    expect(result.outcome).toBe('success');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      `${BASE_URL}/api/v1/courses/${COURSE_ID}/assignments/700/submissions/5`,
    );
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      comment: { text_comment: 'HUMAN REVIEW REQUIRED' },
    });
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
