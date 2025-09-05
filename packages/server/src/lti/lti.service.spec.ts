import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { FactoryModule } from '../factory/factory.module';
import { FactoryService } from '../factory/factory.service';
import {
  CourseFactory,
  initFactoriesFromService,
  lmsCourseIntFactory,
  UserCourseFactory,
  UserFactory,
} from '../../test/util/factories';
import { LtiService, restrictPaths } from './lti.service';
import { IdToken, Provider } from 'lti-typescript';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { ERROR_MESSAGES } from '@koh/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

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

  describe('(static) findMatchingUserCourse', () => {
    it('should throw error if no users match idtoken email', async () => {
      await expect(
        LtiService.findMatchingUserAndCourse(idToken as unknown as IdToken),
      ).rejects.toThrow(
        new NotFoundException(ERROR_MESSAGES.ltiService.noMatchingUser),
      );
    });

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
      expect(userId).toEqual(user.id);
      expect(courseId).toEqual(course.id);
    });
  });

  describe('generateAuthToken', () => {
    it('should generate an auth token', async () => {
      const user = await UserFactory.create();
      const tokenString = await service.generateAuthToken(user.id);

      const token = jwtService.verify<{
        userId: number;
        expiresIn: number;
        restrictPaths?: (RegExp | string)[];
      }>(tokenString);

      expect(token).toEqual({
        userId: user.id,
        expiresIn: 60 * 10,
        restrictPaths,
        iat: expect.anything(),
      });
    });
  });
});
