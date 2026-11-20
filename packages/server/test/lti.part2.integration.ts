// This suite is split across multiple files for performance: Jest runs test
// files in parallel (one per worker) but tests within each file sequentially.
// This file was one of the slowest integration suites, so its tests are split
// roughly 60/40 by runtime between part1 and part2. Add new tests here rather
// than to part1.

import { resetDatabase, setupIntegrationTest } from './util/testUtils';
import { LtiModule } from '../src/lti/lti.module';
import type { Provider } from '@bhunt02/lti-typescript';
import {
  AuthTokenMethodEnum,
  Database,
  register,
} from '@bhunt02/lti-typescript';
import type { UserModel } from '../src/profile/user.entity';
import type { CourseModel } from '../src/course/course.entity';
import {
  CourseFactory,
  lmsOrgIntFactory,
  OrganizationUserFactory,
  OrganizationFactory,
  UserFactory,
} from './util/factories';
import type express from 'express';
import type {
  CreateLtiPlatform,
  LtiPlatform,
  UpdateLtiPlatform,
} from '@koh/common';
import { AuthMethodEnum, ERROR_MESSAGES, UserRole } from '@koh/common';
import { mapToLocalPlatform } from '../src/lti/lti.controller';
import { LtiService } from '../src/lti/lti.service';
import type { LMSOrganizationIntegrationModel } from '../src/lmsIntegration/lmsOrgIntegration.entity';
import { LtiOrganizationRegistrationModel } from '../src/lti/lti-organization-registration.entity';
import { getTestDatabaseName } from './setup/testEnvironment';

const testEncryptionKey = 'abcdefg';
const testLtiDbOptions: any = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_NONROOT_USER,
  password: process.env.POSTGRES_NONROOT_PASSWORD,
  database: getTestDatabaseName('lti_test'),
  extra: { max: 3 }, // max 3 connections. Kept small on purpose for tests (that way it can help expose leaks before it reaches prod).
};

jest.setTimeout(20000);
describe('LtiController', () => {
  let ltiService: LtiService;
  let provider: Provider;
  let platforms: LtiPlatform[] = [];
  let user: UserModel;
  let course: CourseModel;
  let customToken: Record<string, unknown> | undefined;
  let orgIntegration: LMSOrganizationIntegrationModel;

  const defaultToken = {
    iss: 'http://platform.com',
    clientId: '1',
    user: '0',
    userInfo: { email: 'fake_email@example.com' },
    platformInfo: { product_family_code: 'canvas' },
    platformContext: { custom: { canvas_course_id: 'abcdefg' } },
  };

  const mockMiddleware = (
    _: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    res.locals.token = customToken ?? defaultToken;
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
    await Database.initializeDatabase(
      testLtiDbOptions,
      testEncryptionKey,
      true,
    );
  });

  beforeEach(async () => {
    customToken = undefined;
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
    const organization = await OrganizationFactory.create();
    orgIntegration = await lmsOrgIntFactory.create({
      organization,
    });
    await LtiOrganizationRegistrationModel.create({
      ltiPlatformId: platforms[0].kid,
      orgIntegration,
    }).save();
    await OrganizationUserFactory.create({
      organizationUser: user,
      organization,
    });
  });

  afterEach(async () => {
    await resetDatabase(Database.dataSource);
  });

  afterAll(async () => {
    await provider.close();
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
