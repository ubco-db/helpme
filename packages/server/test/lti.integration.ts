import { setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import {
  AuthTokenMethodEnum,
  Database,
  Provider,
  register,
} from 'lti-typescript';
import { UserModel } from '../src/profile/user.entity';
import { CourseModel } from '../src/course/course.entity';
import { CourseFactory, UserFactory } from './util/factories';
import express from 'express';
import {
  AuthMethodEnum,
  CreateLtiPlatform,
  ERROR_MESSAGES,
  LtiPlatform,
  UpdateLtiPlatform,
  UserRole,
} from '@koh/common';
import { mapToLocalPlatform } from '../src/lti/lti.controller';
import { LtiService } from '../src/lti/lti.service';

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

  const mockMiddleware = (
    _: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    res.locals.token = {
      userInfo: { email: 'fake_email@example.com' },
      platformInfo: { product_family_code: 'canvas' },
      platformContext: { custom: { canvas_course_id: 'abcdefg' } },
    };
    res.locals.userId = user?.id;
    res.locals.courseId = course?.id;

    next();
  };

  const { supertest, getTestModule } = setupIntegrationTest(
    LtiModule,
    undefined,
    undefined,
    [mockMiddleware],
  );

  beforeAll(async () => {
    // Initialize connection to LTI database (override library parameters for test)
    await Database.initializeDatabase(
      testLtiDbOptions,
      testEncryptionKey,
      true,
    );
  });

  beforeEach(async () => {
    ltiService = getTestModule().get<LtiService>(LtiService);

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
