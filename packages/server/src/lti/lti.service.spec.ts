import { DataSource, Not } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { FactoryModule } from '../factory/factory.module';
import { FactoryService } from '../factory/factory.service';
import {
  CourseFactory,
  initFactoriesFromService,
  lmsCourseIntFactory,
  LtiCourseInviteFactory,
  LtiIdentityTokenFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
  UserLtiIdentityFactory,
} from '../../test/util/factories';
import { LtiService } from './lti.service';
import { IdToken, Provider } from 'lti-typescript';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from '@koh/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModel } from '../profile/user.entity';
import { CourseModel } from '../course/course.entity';
import { LtiCourseInviteModel } from './lti-course-invite.entity';
import { LtiIdentityTokenModel } from './lti_identity_token.entity';
import { UserLtiIdentityModel } from './user_lti_identity.entity';

const idToken = {
  iss: 'http://canvas.docker/',
  clientId: 'clientid',
  deploymentId: 'deploymentid',
  platformId: 'platformid',
  platformContext: {
    custom: {
      canvas_course_id: '1',
    },
  },
  platformInfo: {
    product_family_code: 'canvas',
  },
  user: '1',
  userInfo: {
    email: 'testuser@example.com',
  },
};

describe('LtiService', () => {
  let service: LtiService;
  let dataSource: DataSource;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET'),
          }),
        }),
      ],
      providers: [LtiService],
    }).compile();

    service = module.get<LtiService>(LtiService);
    dataSource = module.get<DataSource>(DataSource);
    jwtService = module.get<JwtService>(JwtService);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('get provider()', () => {
    it("should throw error if provider wasn't initialized", () => {
      expect(() => service.provider).toThrow(
        new Error('LTI Provider not initialized!'),
      );
    });

    it('should return provider', () => {
      const prov = new Provider();
      service.provider = prov;
      expect(service.provider).toEqual(prov);
    });
  });

  describe('createLtiIdentityToken', () => {
    it('should throw error if JWT fails to be signed', async () => {
      const spy = jest.spyOn(JwtService.prototype, 'sign');

      spy.mockReturnValue(null as any);

      await expect(
        service.createLtiIdentityToken('lms', '0', 'anemail@example.com'),
      ).rejects.toThrow(ERROR_MESSAGES.ltiService.errorSigningJwt);

      spy.mockRestore();
    });

    it('should create JWT and return the token', async () => {
      const result = await service.createLtiIdentityToken(
        'lms',
        '0',
        'anemail@example.com',
      );

      expect(result).toBeDefined();
      expect(jwtService.verify(result)).toEqual(
        expect.objectContaining({
          iat: expect.anything(),
          code: expect.anything(),
        }),
      );
    });
  });

  describe('checkLtiIdentityToken', () => {
    let user: UserModel;

    beforeEach(async () => {
      user = await UserFactory.create();
    });

    it('should throw error if token invalid or missing code', async () => {
      let token = '';
      await expect(
        service.checkLtiIdentityToken(user.id, token),
      ).rejects.toThrow(ERROR_MESSAGES.ltiService.invalidIdentityJwt);

      token = jwtService.sign({});
      await expect(
        service.checkLtiIdentityToken(user.id, token),
      ).rejects.toThrow(ERROR_MESSAGES.ltiService.invalidIdentityJwt);
    });

    it('should return false if matching token not found', async () => {
      const token = jwtService.sign({ code: 'abc' });
      await expect(
        service.checkLtiIdentityToken(user.id, token),
      ).resolves.toEqual(false);
    });

    it('should return false if the token is expired', async () => {
      const tokenModel = await LtiIdentityTokenFactory.create({
        createdAt: new Date(Date.now() - 1000),
        expires: 0,
      });
      const token = jwtService.sign({
        code: tokenModel.code,
      });
      await expect(
        service.checkLtiIdentityToken(user.id, token),
      ).resolves.toEqual(false);
      expect(
        await LtiIdentityTokenModel.findOne({
          where: { code: tokenModel.code },
        }),
      ).toBeNull();
    });

    it.each(['create', 'update'])(
      'should succeed, %s identity entry & delete token and rival entries',
      async (mode: 'create' | 'update') => {
        const tokenModel = await LtiIdentityTokenFactory.create();
        const token = jwtService.sign({
          code: tokenModel.code,
        });

        await UserLtiIdentityFactory.create({
          user: user,
          issuer: tokenModel.issuer,
          ltiUserId: '0',
        });

        if (mode == 'update') {
          const secondary = await UserFactory.create();
          await UserLtiIdentityFactory.create({
            user: secondary,
            issuer: tokenModel.issuer,
            ltiUserId: tokenModel.ltiUserId,
          });
        }

        await expect(
          service.checkLtiIdentityToken(user.id, token),
        ).resolves.toEqual(true);

        const identity = await UserLtiIdentityModel.findOne({
          where: { userId: user.id, issuer: tokenModel.issuer },
        });
        expect(identity).toBeDefined();
        expect(identity.ltiUserId).toEqual(tokenModel.ltiUserId);
        expect(
          await UserLtiIdentityModel.find({
            where: {
              userId: Not(user.id),
              issuer: tokenModel.issuer,
              ltiUserId: tokenModel.ltiUserId,
            },
          }),
        ).toHaveLength(0);
        expect(
          await LtiIdentityTokenModel.findOne({
            where: {
              code: tokenModel.code,
            },
          }),
        ).toBeNull();
      },
    );
  });

  describe('createCourseInvite', () => {
    it('should throw error if JWT fails to be signed', async () => {
      const course = await CourseFactory.create();
      const spy = jest.spyOn(JwtService.prototype, 'sign');

      spy.mockReturnValue(null as any);

      await expect(
        service.createCourseInvite(course.id, 'email'),
      ).rejects.toThrow(ERROR_MESSAGES.ltiService.errorSigningJwt);

      spy.mockRestore();
    });

    it('should create JWT and return the token', async () => {
      const course = await CourseFactory.create();

      const result = await service.createCourseInvite(course.id, 'email');

      expect(result).toBeDefined();
      expect(jwtService.verify(result)).toEqual(
        expect.objectContaining({
          courseId: course.id,
          iat: expect.anything(),
          inviteCode: expect.anything(),
        }),
      );
    });
  });

  describe('checkCourseInvite', () => {
    let user: UserModel;
    let course: CourseModel;

    beforeEach(async () => {
      user = await UserFactory.create();
      course = await CourseFactory.create();
    });

    it('should throw error if token invalid or missing properties', async () => {
      let token = '';
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.invalidInviteJwt,
      );

      token = jwtService.sign({ courseId: course.id });
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.invalidInviteJwt,
      );

      token = jwtService.sign({ courseId: 'ABC' });
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.invalidInviteJwt,
      );

      token = jwtService.sign({ inviteCode: 'abc' });
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.invalidInviteJwt,
      );
    });

    it('should throw error if matching invite not found', async () => {
      const token = jwtService.sign({ courseId: course.id, inviteCode: 'abc' });
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.ltiService.courseInviteNotFound),
      );
    });

    it('should throw error if invite email != user email', async () => {
      const invite = await LtiCourseInviteFactory.create({
        course,
        email: 'email@example.com',
      });
      const token = jwtService.sign({
        courseId: course.id,
        inviteCode: invite.inviteCode,
      });

      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.courseInviteEmailMismatch,
      );
    });

    it('should throw error if course belongs to different organization than user', async () => {
      const org0 = await OrganizationFactory.create();
      const org1 = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org0,
      });

      await OrganizationCourseFactory.create({
        course,
        organization: org1,
      });

      const invite = await LtiCourseInviteFactory.create({
        course,
        email: user.email,
      });
      const token = jwtService.sign({
        courseId: course.id,
        inviteCode: invite.inviteCode,
      });

      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        new NotFoundException(
          ERROR_MESSAGES.ltiService.courseInviteOrganizationMismatch,
        ),
      );
    });

    it('should throw error if the invite is expired', async () => {
      const org = await OrganizationFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await OrganizationCourseFactory.create({
        course,
        organization: org,
      });

      const invite = await LtiCourseInviteFactory.create({
        course,
        email: user.email,
        createdAt: new Date(Date.now() - 1000),
        expires: 0,
      });
      const token = jwtService.sign({
        courseId: course.id,
        inviteCode: invite.inviteCode,
      });
      await expect(service.checkCourseInvite(user.id, token)).rejects.toThrow(
        ERROR_MESSAGES.ltiService.courseInviteExpired,
      );
    });

    it('should succeed, create enrollment & delete invites like the invite', async () => {
      const org = await OrganizationFactory.create();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: org,
      });
      await OrganizationCourseFactory.create({
        course,
        organization: org,
      });

      const invites: LtiCourseInviteModel[] = [];
      for (let i = 0; i < 3; i++) {
        invites.push(
          await LtiCourseInviteFactory.create({
            course,
            email: user.email,
          }),
        );
      }
      const token = jwtService.sign({
        courseId: course.id,
        inviteCode: invites[0].inviteCode,
      });
      await expect(service.checkCourseInvite(user.id, token)).resolves.toEqual(
        course.id,
      );

      expect(
        await LtiCourseInviteModel.find({
          where: {
            course,
            email: user.email,
          },
        }),
      ).toHaveLength(0);
    });
  });

  describe('(static) findMatchingUserCourse', () => {
    it('should return matching user', async () => {
      const user = await UserFactory.create({
        email: 'testuser@example.com',
      });
      const { userId, courseId } = await LtiService.findMatchingUserAndCourse({
        ...idToken,
        platformContext: {
          custom: undefined,
        },
      } as unknown as IdToken);
      expect(
        await UserLtiIdentityModel.findOne({
          where: {
            userId: user.id,
            issuer: idToken.iss,
          },
        }),
      ).toBeDefined();
      expect(userId).toEqual(user.id);
      expect(courseId).toBeUndefined();
    });

    it('should return matching user if course id was parseable', async () => {
      const user = await UserFactory.create({
        email: 'testuser@example.com',
      });
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user,
        course,
      });
      await lmsCourseIntFactory.create({
        course,
        apiCourseId: idToken.platformContext.custom.canvas_course_id,
      });
      const { userId, courseId } = await LtiService.findMatchingUserAndCourse(
        idToken as unknown as IdToken,
      );
      expect(
        await UserLtiIdentityModel.findOne({
          where: {
            userId: user.id,
            issuer: idToken.iss,
          },
        }),
      ).toBeDefined();
      expect(userId).toEqual(user.id);
      expect(courseId).toEqual(course.id);
    });
  });
});
