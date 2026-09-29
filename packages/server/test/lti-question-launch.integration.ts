import express from 'express';
import {
  AuthTokenMethodEnum,
  Database,
  Provider,
  register,
} from '@bhunt02/lti-typescript';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@koh/common';
import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  CourseFactory,
  lmsCourseIntFactory,
  UserFactory,
  lmsOrgIntFactory,
  OrganizationUserFactory,
  OrganizationFactory,
} from './util/factories';
import { EmbeddableQuestionModel } from '../src/lti/embeddable-question/embeddable-question.entity';
import { UserCourseModel } from '../src/profile/user-course.entity';
import { LTI_APP_SESSION_SECONDS } from '../src/lti/lti-auth.controller';
import {
  LtiService,
  LTI_MEMBERSHIP_LEARNER_ROLE,
} from '../src/lti/lti.service';
import { getAuthPayload } from '../src/login/auth-token';

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

  const ltiDbOptions = {
    type: 'postgres' as const,
    host: 'localhost',
    port: 5432,
    username: process.env.POSTGRES_NONROOT_USER,
    password: process.env.POSTGRES_NONROOT_PASSWORD,
    database: 'lti_test',
  };
  let provider: Provider;
  let platformId: string;
  beforeAll(async () => {
    await Database.initializeDatabase(ltiDbOptions, 'test-key', true);
    provider = await register('test-key', ltiDbOptions, {});
  });
  afterAll(async () => {
    await provider.close();
  });
  afterEach(async () => {
    await Database.dataSource.synchronize(true);
  });

  beforeEach(async () => {
    userId = undefined;
    courseId = undefined;
    token = undefined;
    getTestModule().get<LtiService>(LtiService).provider = provider;
    const platform = await provider.registerPlatform({
      name: 'Canvas',
      platformUrl: 'https://canvas.example.edu',
      clientId: 'canvas-client-id',
      active: true,
      authenticationEndpoint: 'https://canvas.example.edu/auth',
      accessTokenEndpoint: 'https://canvas.example.edu/token',
      authToken: {
        method: AuthTokenMethodEnum.JWK_SET,
        key: 'https://canvas.example.edu/keys',
      },
    });
    platformId = platform.kid;
  });

  const setupMappedQuestion = async () => {
    const user = await UserFactory.create({ email: 'student@example.com' });
    const course = await CourseFactory.create();
    const organization = await OrganizationFactory.create();
    const orgIntegration = await lmsOrgIntFactory.create({
      organization,
      ltiPlatformId: platformId,
    });
    await OrganizationUserFactory.create({
      organizationUser: user,
      organization,
    });
    await lmsCourseIntFactory.create({
      orgIntegration,
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
    const payload = getAuthPayload(rawJwtToken);
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

  it.each([Role.PROFESSOR, Role.TA])(
    'enrolls a first-time %s on a question preview',
    async (role) => {
      const { user, course, question } = await setupMappedQuestion();
      token = buildLaunchToken({ email: user.email, questionId: question.id });
      token.platformContext.roles = [
        `http://purl.imsglobal.org/vocab/lis/v2/membership#${role === Role.PROFESSOR ? 'Instructor' : 'TeachingAssistant'}`,
      ];
      await supertest().get('/lti').expect(302);
      expect(
        await UserCourseModel.findOneBy({
          userId: user.id,
          courseId: course.id,
        }),
      ).toMatchObject({ role });
    },
  );

  it('preserves a professor enrollment on a learner launch', async () => {
    const { user, course } = await setupMappedQuestion();
    await UserCourseModel.create({
      userId: user.id,
      courseId: course.id,
      role: Role.PROFESSOR,
    }).save();
    await supertest().get('/lti').expect(302);
    expect(
      await UserCourseModel.findOneBy({ userId: user.id, courseId: course.id }),
    ).toMatchObject({ role: Role.PROFESSOR });
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
