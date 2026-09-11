import express from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@koh/common';
import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  CourseFactory,
  lmsCourseIntFactory,
  UserFactory,
} from './util/factories';
import { EmbeddableQuestionModel } from '../src/lti/embeddable/question/embeddable-question.entity';
import { UserCourseModel } from '../src/profile/user-course.entity';
import { LTI_APP_SESSION_SECONDS } from '../src/lti/lti-auth.controller';
import { LTI_MEMBERSHIP_LEARNER_ROLE } from '../src/lti/lti.service';
import { getAppAuthPayload } from '../src/login/auth-token';

const gradingSettings = (rubric: string) => ({
  rubric,
  feedbackInstructions:
    'Give concise, constructive feedback grounded in the rubric.',
  scoreScale: { max: 10, step: 1 },
  checks: [],
});

const buildLaunchToken = ({
  email,
  questionId,
  clientId = 'canvas-client-id',
}: {
  email: string;
  questionId: number;
  clientId?: string;
}) => ({
  iss: 'https://canvas.example.edu',
  clientId,
  deploymentId: 'deployment-1',
  user: 'canvas-user-1',
  userInfo: { email },
  platformInfo: {
    product_family_code: 'canvas',
    guid: 'canvas-guid',
  },
  platformContext: {
    roles: [LTI_MEMBERSHIP_LEARNER_ROLE],
    custom: {
      canvas_course_id: 'canvas-course-123',
      helpme_question_id: String(questionId),
    },
  },
});

type MockLaunchToken = ReturnType<typeof buildLaunchToken>;

describe('LTI question launch', () => {
  let userId: number | undefined;
  let courseId: number | undefined;
  let token: MockLaunchToken | undefined;

  const mockLtiMiddleware = (
    _: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    res.locals.token = token;
    res.locals.userId = userId;
    res.locals.courseId = courseId;
    next();
  };

  const { supertest, getTestModule } = setupIntegrationTest(
    LtiModule,
    undefined,
    undefined,
    [mockLtiMiddleware],
  );

  beforeEach(() => {
    userId = undefined;
    courseId = undefined;
    token = undefined;
    getTestModule()
      .get<ConfigService>(ConfigService)
      .set('LTI_CANVAS_CLIENT_ID', 'canvas-client-id');
  });

  const setupMappedQuestion = async () => {
    const user = await UserFactory.create({ email: 'student@example.com' });
    const course = await CourseFactory.create();
    await lmsCourseIntFactory.create({
      course,
      apiCourseId: 'canvas-course-123',
    });
    const question = await EmbeddableQuestionModel.create({
      courseId: course.id,
      title: 'Question',
      questionText: 'Question text',
      gradingSettings: gradingSettings('Hidden criteria'),
    }).save();

    userId = user.id;
    courseId = course.id;
    token = buildLaunchToken({ email: user.email, questionId: question.id });

    return { user, course, question };
  };

  it('uses the normal HelpMe session and enrollment path for a mapped question launch', async () => {
    const { user, course, question } = await setupMappedQuestion();

    const res = await supertest().get('/lti').expect(302);
    const location = new URL('https://example.com' + res.headers.location);
    expect(location.pathname).toBe(
      `/lti/embeddable/${course.id}/question/${question.id}`,
    );

    const cookie = (res.get('Set-Cookie') ?? []).find((value) =>
      value.startsWith('lti_auth_token='),
    );
    if (!cookie) {
      throw new Error('Missing lti_auth_token cookie');
    }
    expect(
      (res.get('Set-Cookie') ?? []).some((value) =>
        value.startsWith('lti_resource_'),
      ),
    ).toBe(false);

    const encodedToken = cookie.split(';')[0].slice('lti_auth_token='.length);
    const rawJwtToken: unknown = getTestModule()
      .get<JwtService>(JwtService)
      .verify(encodedToken);
    const payload = getAppAuthPayload(rawJwtToken);
    expect(payload.userId).toBe(user.id);
    const { iat, exp } = payload;
    if (typeof iat !== 'number' || typeof exp !== 'number') {
      throw new Error('Expected standard JWT iat and exp claims');
    }
    expect(exp - iat).toBe(LTI_APP_SESSION_SECONDS);

    await expect(
      UserCourseModel.findOne({
        where: { userId: user.id, courseId: course.id },
      }),
    ).resolves.toEqual(expect.objectContaining({ role: Role.STUDENT }));
  });

  it('rejects a question launch from a different Canvas client before issuing a session', async () => {
    const { user, question } = await setupMappedQuestion();
    token = buildLaunchToken({
      email: user.email,
      questionId: question.id,
      clientId: 'other-client-id',
    });

    const res = await supertest().get('/lti').expect(403);
    expect(
      (res.get('Set-Cookie') ?? []).some((value) =>
        value.startsWith('lti_auth_token='),
      ),
    ).toBe(false);
  });

  it('rejects a question that belongs to another HelpMe course', async () => {
    const { user, course } = await setupMappedQuestion();
    const otherCourse = await CourseFactory.create();
    const otherQuestion = await EmbeddableQuestionModel.create({
      courseId: otherCourse.id,
      title: 'Other question',
      questionText: 'Other question',
      gradingSettings: gradingSettings('Hidden criteria'),
    }).save();

    token = buildLaunchToken({
      email: user.email,
      questionId: otherQuestion.id,
    });

    await supertest().get('/lti').expect(404);
    expect(
      await UserCourseModel.findOne({
        where: { userId: user.id, courseId: course.id },
      }),
    ).toBeNull();
  });
});
