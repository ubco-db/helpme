import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import {
  AUTOGRADER_GRADING_MODE,
  AutograderAttemptStatus,
  AutograderQuestionStatus,
  AutograderRunStatus,
  FINAL_GRADING_INSTRUCTION,
  LMSApiResponseStatus,
  Role,
  type QuestionGradingSettings,
  AUTOGRADER_QUEUE_NAME,
} from '@koh/common';
import { LtiModule } from '../src/lti/lti.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  CourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { EmbeddableQuestionModel } from '../src/lti/embeddable-question/embeddable-question.entity';
import { AutograderRunModel } from '../src/lti/autograder/autograder-run.entity';
import { AutograderAttemptModel } from '../src/lti/autograder/autograder-attempt.entity';
import { LMSIntegrationService } from '../src/lmsIntegration/lmsIntegration.service';
import type {
  LMSClassicQuiz,
  LMSClassicQuizCatalogResult,
} from '../src/lmsIntegration/lmsIntegration.adapter';

const gradingSettings: QuestionGradingSettings = {
  rubric: 'Award points for an accurate answer.',
  feedbackInstructions: 'Be concise.',
  scoreScale: { max: 5, step: 1 },
  checks: [],
};

function quiz(
  embeddableQuestionId: number,
  overrides: Partial<LMSClassicQuiz> = {},
): LMSClassicQuiz {
  return {
    quizId: 55,
    title: 'Essay Quiz',
    assignmentId: 900,
    postManually: true,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    blockingReason: null,
    essayQuestions: [
      {
        id: 101,
        position: 1,
        text: 'Explain the idea.',
        points: 5,
        mapping: {
          status: 'detected',
          lookupUuid: '11111111-1111-4111-8111-111111111111',
          embeddableQuestionId,
        },
      },
    ],
    ...overrides,
  };
}

function runData(
  courseId: number,
  userId: number,
  overrides: Partial<AutograderRunModel> = {},
): Partial<AutograderRunModel> {
  return {
    courseId,
    canvasQuizId: 55,
    assignmentId: 900,
    quizTitle: 'Essay Quiz',
    status: AutograderRunStatus.Running,
    gradingMode: AUTOGRADER_GRADING_MODE,
    instruction: FINAL_GRADING_INSTRUCTION,
    speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
    createdByUserId: userId,
    regradeSubmissions: false,
    includePostedGrades: false,
    questionSnapshots: [],
    error: null,
    completedAt: null,
    ...overrides,
  };
}

function createRun(
  courseId: number,
  userId: number,
  overrides: Partial<AutograderRunModel> = {},
): Promise<AutograderRunModel> {
  const repository = AutograderRunModel.getRepository();
  return repository.save(
    repository.create(runData(courseId, userId, overrides)),
  );
}

describe('Autograder endpoints', () => {
  const getClassicQuizCatalog = jest.fn<
    Promise<LMSClassicQuizCatalogResult>,
    [number?]
  >();
  const { supertest, getTestModule } = setupIntegrationTest(
    LtiModule,
    (builder) =>
      builder.overrideProvider(LMSIntegrationService).useValue({
        getAdapter: jest.fn().mockResolvedValue({ getClassicQuizCatalog }),
      }),
  );
  let queue: Queue;

  beforeAll(() => {
    queue = getTestModule().get<Queue>(getQueueToken(AUTOGRADER_QUEUE_NAME));
    jest.spyOn(queue, 'add').mockResolvedValue({} as never);
  });

  beforeEach(() => {
    jest.mocked(queue.add).mockClear();
    getClassicQuizCatalog.mockReset();
  });

  const setupCourseMember = async (role: Role) => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({ user, course, role });
    return { user, course };
  };

  it('does not expose the autograder to students', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);

    await supertest({ userId: user.id })
      .get(`/lti/embeddable/autograder/${course.id}/quizzes`)
      .expect(403);
    expect(getClassicQuizCatalog).not.toHaveBeenCalled();
  });

  it('lists a practice quiz with a blocking reason', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const reason =
      'This is a practice quiz (a Classic quiz with no graded assignment), so it does not produce a graded submission and cannot be autograded.';
    getClassicQuizCatalog.mockResolvedValue({
      status: LMSApiResponseStatus.Success,
      quizzes: [
        quiz(0, {
          assignmentId: null,
          speedGraderUrl: null,
          postManually: false,
          blockingReason: reason,
          essayQuestions: [],
        }),
      ],
    });

    const response = await supertest({ userId: user.id })
      .get(`/lti/embeddable/autograder/${course.id}/quizzes`)
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        canvasQuizId: 55,
        assignmentId: null,
        blockingReason: reason,
      }),
    ]);
  });

  it('starts, lists, and reports an autograder run', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Essay question',
      questionText: 'Explain the idea.',
      gradingSettings,
    }).save();
    getClassicQuizCatalog.mockResolvedValue({
      status: LMSApiResponseStatus.Success,
      quizzes: [quiz(question.id)],
    });

    const started = await supertest({ userId: user.id })
      .post(`/lti/embeddable/autograder/${course.id}/runs`)
      .send({ canvasQuizId: 55, regradeSubmissions: true })
      .expect(201);

    expect(started.body).toMatchObject({
      canvasQuizId: 55,
      regradeSubmissions: true,
      includePostedGrades: false,
      resumed: false,
      status: AutograderRunStatus.Running,
    });
    expect(queue.add).toHaveBeenCalledTimes(1);

    const runs = await supertest({ userId: user.id })
      .get(`/lti/embeddable/autograder/${course.id}/runs`)
      .expect(200);
    expect(runs.body).toHaveLength(1);
    // The polled summary must stay small; frozen question snapshots are internal.
    expect(runs.body[0]).not.toHaveProperty('questions');

    const report = await supertest({ userId: user.id })
      .get(
        `/lti/embeddable/autograder/${course.id}/runs/${started.body.id}/report`,
      )
      .expect(200);
    expect(report.body.run.id).toBe(started.body.id);
    expect(report.body.run).not.toHaveProperty('questions');
    expect(report.body.errors).toEqual([]);
    expect(report.body.flags).toEqual([]);
  });

  it('cancels a running run and is idempotent', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const run = await createRun(course.id, user.id);

    const cancelled = await supertest({ userId: user.id })
      .post(`/lti/embeddable/autograder/${course.id}/runs/${run.id}/cancel`)
      .expect(201);
    expect(cancelled.body).toMatchObject({
      id: run.id,
      status: AutograderRunStatus.Cancelled,
      completedAt: expect.any(String),
    });

    const again = await supertest({ userId: user.id })
      .post(`/lti/embeddable/autograder/${course.id}/runs/${run.id}/cancel`)
      .expect(201);
    expect(again.body.status).toBe(AutograderRunStatus.Cancelled);

    const runs = await supertest({ userId: user.id })
      .get(`/lti/embeddable/autograder/${course.id}/runs`)
      .expect(200);
    expect(runs.body[0]).toMatchObject({
      id: run.id,
      status: AutograderRunStatus.Cancelled,
    });
  });

  it('does not let a student cancel a run', async () => {
    const { user, course } = await setupCourseMember(Role.STUDENT);
    const run = await createRun(course.id, 1);

    await supertest({ userId: user.id })
      .post(`/lti/embeddable/autograder/${course.id}/runs/${run.id}/cancel`)
      .expect(403);
    expect((await AutograderRunModel.findOneBy({ id: run.id }))?.status).toBe(
      AutograderRunStatus.Running,
    );
  });

  it('rejects includePostedGrades without regradeSubmissions', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);

    await supertest({ userId: user.id })
      .post(`/lti/embeddable/autograder/${course.id}/runs`)
      .send({ canvasQuizId: 55, includePostedGrades: true })
      .expect(400);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('reports per-question errors and human-review flags', async () => {
    const { user, course } = await setupCourseMember(Role.PROFESSOR);
    const run = await AutograderRunModel.create({
      courseId: course.id,
      canvasQuizId: 55,
      assignmentId: 900,
      quizTitle: 'Essay Quiz',
      status: AutograderRunStatus.Completed,
      gradingMode: AUTOGRADER_GRADING_MODE,
      instruction: FINAL_GRADING_INSTRUCTION,
      speedGraderUrl: 'https://canvas.test/speed_grader?assignment_id=900',
      createdByUserId: user.id,
      regradeSubmissions: false,
      includePostedGrades: false,
      questionSnapshots: [],
      error: null,
      completedAt: new Date(),
    }).save();
    await AutograderAttemptModel.create({
      runId: run.id,
      quizSubmissionId: 500,
      canvasUserId: 42,
      attemptNumber: 1,
      status: AutograderAttemptStatus.Error,
      readable: true,
      error: null,
      questions: [
        {
          canvasQuestionId: 101,
          position: 1,
          embeddableQuestionId: 11,
          maxScore: 5,
          answer: 'An answer.',
          gradingSnapshot: {
            questionText: 'Explain the idea.',
            gradingSettings,
            gradingMode: 'final',
            instruction: FINAL_GRADING_INSTRUCTION,
          },
          status: AutograderQuestionStatus.Error,
          score: null,
          comment: null,
          model: null,
          reasons: [],
          humanReviewReason: null,
          error: 'Grading failed for this question.',
        },
        {
          canvasQuestionId: 102,
          position: 2,
          embeddableQuestionId: 12,
          maxScore: 5,
          answer: 'Another answer.',
          gradingSnapshot: {
            questionText: 'Explain the second idea.',
            gradingSettings,
            gradingMode: 'final',
            instruction: FINAL_GRADING_INSTRUCTION,
          },
          status: AutograderQuestionStatus.Written,
          score: 4,
          comment: 'Good answer.',
          model: 'test-model',
          reasons: ['accurate'],
          humanReviewReason: 'Needs a human check.',
          error: null,
        },
      ],
    }).save();

    const response = await supertest({ userId: user.id })
      .get(`/lti/embeddable/autograder/${course.id}/runs/${run.id}/report`)
      .expect(200);

    expect(response.body.errors).toEqual([
      expect.objectContaining({
        source: 'question',
        position: 1,
        error: 'Grading failed for this question.',
      }),
    ]);
    expect(response.body.flags).toEqual([
      expect.objectContaining({
        position: 2,
        reason: 'Needs a human check.',
      }),
    ]);
    expect(response.body.run.counts).toMatchObject({
      attempts: 1,
      questions: 2,
      written: 1,
      errors: 1,
      flagged: 1,
    });
  });
});
