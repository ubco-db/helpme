import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  AuthTokenMethodEnum,
  Database,
  Provider,
  register,
} from '@bhunt02/lti-typescript';
import { UserModel } from '../src/profile/user.entity';
import { CourseModel } from '../src/course/course.entity';
import {
  CourseFactory,
  lmsCourseIntFactory,
  UserCourseFactory,
  UserFactory,
  UserLtiIdentityFactory,
} from './util/factories';
import express from 'express';
import {
  AuthMethodEnum,
  CreateLtiPlatform,
  createGradingPreset,
  ERROR_MESSAGES,
  LtiPlatform,
  Role,
  UpdateLtiPlatform,
  UserRole,
} from '@koh/common';
import { mapToLocalPlatform } from '../src/lti/lti.controller';
import { LtiService } from '../src/lti/lti.service';
import { EmbeddableQuestionModel } from '../src/lti/embeddable/question/embeddable-question.entity';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

const testEncryptionKey = 'abcdefg';
const testLtiDbOptions: any = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: process.env.POSTGRES_NONROOT_USER,
  password: process.env.POSTGRES_NONROOT_PASSWORD,
  database: 'lti_test',
};

jest.setTimeout(20000);
describe('LtiController', () => {
  let ltiService: LtiService;
  let provider: Provider;
  let platforms: LtiPlatform[] = [];
  let user: UserModel;
  let course: CourseModel;
  let customToken: Record<string, unknown> | null | undefined;
  let configService: ConfigService;
  let originalCanvasClientId: string | undefined;

  const mockMiddleware = (
    _: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (customToken === null) {
      res.locals.token = undefined;
    } else if (customToken !== undefined) {
      res.locals.token = customToken;
      res.locals.userId = user?.id;
      res.locals.courseId = course?.id;
    } else {
      res.locals.token = {
        iss: 'fake-issuer',
        user: '0',
        userInfo: { email: 'fake_email@example.com' },
        platformInfo: { product_family_code: 'canvas' },
        platformContext: { custom: { canvas_course_id: 'abcdefg' } },
      };
      res.locals.userId = user?.id;
      res.locals.courseId = course?.id;
    }

    next();
  };

  const { supertest, getTestModule } = setupIntegrationTest(
    LtiModule,
    undefined,
    undefined,
    [mockMiddleware],
  );

  beforeAll(async () => {
    await Database.initializeDatabase(
      testLtiDbOptions,
      testEncryptionKey,
      true,
    );
  });

  beforeEach(async () => {
    customToken = undefined;
    ltiService = getTestModule().get<LtiService>(LtiService);
    configService = getTestModule().get<ConfigService>(ConfigService);
    originalCanvasClientId ??= configService.get<string>(
      'LTI_CANVAS_CLIENT_ID',
    );

    provider = await register(testEncryptionKey, testLtiDbOptions, {});
    ltiService.provider = provider;

    user = await UserFactory.create();
    course = await CourseFactory.create();
    platforms = [];
    for (let i = 0; i < 3; i++) {
      const platform = await provider.registerPlatform({
        name: `platform${i + 1}`,
        platformUrl: 'http://platform.com',
        clientId: String(i + 1),
        accessTokenEndpoint: 'http://platform.com/keys',
        authenticationEndpoint: 'http://platform.com/auth',
        authToken: {
          method: AuthTokenMethodEnum.JWK_SET,
          key: 'http://platform.com/keys',
        },
        active: true,
      });
      platforms.push(mapToLocalPlatform(platform['platformModel']));
    }
  });

  afterEach(async () => {
    configService.set('LTI_CANVAS_CLIENT_ID', originalCanvasClientId);
    await Database.dataSource.synchronize(true);
  });

  afterAll(async () => {
    await provider.close();
  });

  describe('ALL lti/', () => {
    it('should redirect to login if user and/or course not found', async () => {
      user = undefined;
      course = undefined;
      await supertest()
        .get('/lti')
        .expect(302)
        .then((response) => {
          const location = new URL(
            'https://example.com' + response.headers['location'],
          );
          expect(response.headers['set-cookie']?.[0]).toEqual(
            expect.stringContaining('__LTI_IDENTITY='),
          );
          expect(location.pathname).toEqual(`/lti/login`);
        });
    });

    it('should create course invite if user does not exist but course found', async () => {
      user = undefined;
      await supertest()
        .get('/lti')
        .expect(302)
        .then((response) => {
          const location = new URL(
            'https://example.com' + response.headers['location'],
          );
          expect(response.headers['set-cookie']?.[0]).toEqual(
            expect.stringContaining('__LTI_IDENTITY='),
          );
          expect(response.headers['set-cookie']?.[1]).toEqual(
            expect.stringContaining('__COURSE_INVITE='),
          );
          expect(location.pathname).toEqual(`/lti/login`);
          expect(location.searchParams.get('redirect')).toEqual(
            `/lti/${course.id}`,
          );
        });
    });

    it('should redirect to lti courses page', async () => {
      await supertest()
        .get('/lti')
        .expect(302)
        .then((response) => {
          const location = new URL(
            'https://example.com' + response.headers['location'],
          );
          expect(location.pathname).toEqual(`/lti/${course.id}`);
          expect(location.searchParams.get('api_course_id')).toEqual('abcdefg');
          expect(location.searchParams.get('lms_platform')).toEqual('Canvas');
        });
    });
  });

  describe('Deep Linking', () => {
    const canvasCourseId = 'canvas-course-deep-link';
    const instructorRole =
      'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';

    const setupDeepLinkLaunch = async (helpMeRole: Role) => {
      configService.set('LTI_CANVAS_CLIENT_ID', '1');
      await lmsCourseIntFactory.create({
        course,
        apiCourseId: canvasCourseId,
      });
      await UserLtiIdentityFactory.create({
        user,
        issuer: 'http://platform.com',
        ltiUserId: 'canvas-instructor-1',
      });
      await UserCourseFactory.create({ user, course, role: helpMeRole });
      customToken = {
        iss: 'http://platform.com',
        clientId: '1',
        deploymentId: 'deployment-1',
        user: 'canvas-instructor-1',
        userInfo: { email: user.email },
        platformInfo: { product_family_code: 'canvas' },
        platformContext: {
          messageType: 'LtiDeepLinkingRequest',
          roles: [instructorRole],
          deepLinkingSettings: {
            deep_link_return_url: 'http://platform.com/deep-link-return',
            accept_types: ['ltiResourceLink'],
          },
          custom: { canvas_course_id: canvasCourseId },
          targetLinkUri: 'http://helpme.test/api/v1/lti',
        },
      };
    };

    it('lets a mapped HelpMe professor list the questions available to Canvas', async () => {
      await setupDeepLinkLaunch(Role.PROFESSOR);
      const question = await EmbeddableQuestionModel.create({
        courseId: course.id,
        title: 'Reflection 1',
        questionText: 'Question text',
        gradingSettings: {
          ...createGradingPreset('generic'),
          rubric: 'Criteria text',
        },
      }).save();

      const res = await supertest().get('/lti/deep-link/questions').expect(200);

      expect(res.body).toEqual([
        expect.objectContaining({
          id: question.id,
          courseId: course.id,
          title: 'Reflection 1',
        }),
      ]);
    });

    it('does not let a Canvas instructor elevate a HelpMe student through Deep Linking', async () => {
      await setupDeepLinkLaunch(Role.STUDENT);

      await supertest().get('/lti/deep-link/questions').expect(403);
    });

    it('rejects selecting a question from a different HelpMe course before signing', async () => {
      await setupDeepLinkLaunch(Role.PROFESSOR);
      const otherCourse = await CourseFactory.create();
      const otherQuestion = await EmbeddableQuestionModel.create({
        courseId: otherCourse.id,
        title: 'Other course question',
        questionText: 'Question text',
        gradingSettings: {
          ...createGradingPreset('generic'),
          rubric: 'Criteria text',
        },
      }).save();

      await supertest()
        .post('/lti/deep-link/selection')
        .send({ questionId: otherQuestion.id })
        .expect(404);
    });

    it('returns a provider-signed deep linking response for a question in the mapped course', async () => {
      await setupDeepLinkLaunch(Role.PROFESSOR);
      const question = await EmbeddableQuestionModel.create({
        courseId: course.id,
        title: 'Reflection 2',
        questionText: 'Question text',
        gradingSettings: {
          ...createGradingPreset('generic'),
          rubric: 'Criteria text',
        },
      }).save();

      const res = await supertest()
        .post('/lti/deep-link/selection')
        .send({ questionId: question.id })
        .expect(200)
        .expect('Content-Type', /text\/html/);

      const signedToken = /name="JWT" value="([^"]+)"/.exec(res.text)?.[1];
      if (!signedToken) {
        throw new Error('Deep linking response did not contain a signed JWT');
      }

      const platform = await provider.getPlatform('http://platform.com', '1');
      if (!platform) {
        throw new Error('Canvas platform was not registered');
      }
      const publicKey = (await platform.platformPublicKey()).key;

      const decoded = jwt.decode(signedToken, { complete: true });
      if (typeof decoded !== 'object' || decoded === null) {
        throw new Error('Deep linking response JWT could not be decoded');
      }
      expect(decoded.header.alg).toBe('RS256');
      expect(decoded.header.kid).toBe(platform.kid);

      const claims = jwt.verify(signedToken, publicKey, {
        algorithms: ['RS256'],
      });
      if (typeof claims === 'string') {
        throw new Error('Deep linking JWT verified to a string payload');
      }

      // Signed by the platform the professor's Canvas registration uses
      expect(claims.iss).toBe(platform.clientId);
      expect(claims.aud).toBe('http://platform.com');
      expect(
        claims['https://purl.imsglobal.org/spec/lti/claim/message_type'],
      ).toBe('LtiDeepLinkingResponse');
      expect(claims['https://purl.imsglobal.org/spec/lti/claim/version']).toBe(
        '1.3.0',
      );
      expect(
        claims['https://purl.imsglobal.org/spec/lti/claim/deployment_id'],
      ).toBe('deployment-1');
      expect(claims['https://purl.imsglobal.org/spec/lti-dl/claim/msg']).toBe(
        'HelpMe question linked',
      );

      // The selected item is the question from the professor's own course
      expect(
        claims['https://purl.imsglobal.org/spec/lti-dl/claim/content_items'],
      ).toEqual([
        {
          type: 'ltiResourceLink',
          title: question.title,
          url: 'http://helpme.test/api/v1/lti',
          custom: { helpme_question_id: String(question.id) },
          iframe: {
            src: 'http://helpme.test/api/v1/lti',
            width: 800,
            height: 300,
          },
        },
      ]);
    });
  });

  describe('GET lti/platform', () => {
    const url = '/lti/platform';

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .get(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .get(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should succeed with 200 and return HMS-platform representation list', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      await supertest({ userId: user.id })
        .get(url)
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual(expect.arrayContaining(platforms));
        });
    });
  });

  describe('GET lti/platform/:kid', () => {
    let url: string;

    beforeEach(async () => {
      url = `/lti/platform/${platforms[0].kid}`;
    });

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .get(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .get(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should succeed with 200 and return HMS-platform representation', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      await supertest({ userId: user.id })
        .get(url)
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual(platforms[0]);
        });
    });
  });

  describe('POST lti/platform', () => {
    const url = '/lti/platform';

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .post(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .post(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should fail with 400 if missing properties or properties incorrect', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      await supertest({ userId: user.id }).post(url).expect(400);
    });

    it('should succeed with 201 and return HMS-platform representation', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      const props = {
        platformUrl: 'http://platform.com',
        clientId: '4',
        name: 'platform4',
        authenticationEndpoint: 'http://platform.com/auth',
        accessTokenEndpoint: 'http://platform.com/keys',
        active: true,
        authToken: {
          method: AuthMethodEnum.JWK_SET,
          key: 'http://platform.com/keys',
        },
      } satisfies CreateLtiPlatform;

      await supertest({ userId: user.id })
        .post(url)
        .send(props)
        .expect(201)
        .then((response) => {
          expect(response.body).toEqual(
            expect.objectContaining({
              ...props,
            }),
          );
        });
    });
  });

  describe('PATCH lti/platform/:kid', () => {
    let url: string;

    beforeEach(async () => {
      url = `/lti/platform/${platforms[0].kid}`;
    });

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .patch(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .patch(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should succeed with 200 and return HMS-platform representation', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      const props = {
        platformUrl: 'http://platform.com',
        clientId: '4',
        name: 'platform4',
        authenticationEndpoint: 'http://platform.com/auth',
        accessTokenEndpoint: 'http://platform.com/keys',
        active: true,
        authToken: {
          method: AuthMethodEnum.JWK_SET,
          key: 'http://platform.com/keys',
        },
      } satisfies UpdateLtiPlatform;

      await supertest({ userId: user.id })
        .patch(url)
        .send(props)
        .expect(200)
        .then((response) => {
          expect(response.body).toEqual(
            expect.objectContaining({
              ...props,
            }),
          );
        });

      const prov = mapToLocalPlatform(
        (await provider.getPlatformById(platforms[0].kid))['platformModel'],
      );
      expect(prov).toEqual(expect.objectContaining({ ...props }));
    });
  });

  describe('DELETE lti/platform/:kid', () => {
    let url: string;

    beforeEach(async () => {
      url = `/lti/platform/${platforms[0].kid}`;
    });

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .delete(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .delete(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should succeed with 200', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      await supertest({ userId: user.id }).delete(url).expect(200);

      const found = await provider.getPlatformById(platforms[0].kid);
      expect(found).toBeUndefined();
    });
  });

  describe('POST lti/platform/:kid/toggle', () => {
    let url: string;

    beforeEach(async () => {
      url = `/lti/platform/${platforms[0].kid}/toggle`;
    });

    it('should fail with 401 if user is unauthorized', async () => {
      await supertest()
        .patch(url)
        .expect(401)
        .then((response) => {
          expect(response.body).toHaveProperty('message', 'Unauthorized');
        });
    });

    it('should fail with 403 if user does not have website admin role', async () => {
      const user = await UserFactory.create();
      await supertest({ userId: user.id })
        .patch(url)
        .expect(403)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'message',
            ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([UserRole.ADMIN]),
          );
        });
    });

    it('should enable/disable platform', async () => {
      const user = await UserFactory.create({ userRole: UserRole.ADMIN });

      await supertest({ userId: user.id }).patch(url).expect(200);

      let found = await provider.getPlatformById(platforms[0].kid);
      expect(found.active).toEqual(false);

      await supertest({ userId: user.id }).patch(url).expect(200);

      found = await provider.getPlatformById(platforms[0].kid);
      expect(found.active).toEqual(true);
    });
  });
});
