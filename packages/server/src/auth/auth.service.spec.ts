import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { UserModel } from 'profile/user.entity';
import { DataSource } from 'typeorm';
import {
  initFactoriesFromService,
  OrganizationFactory,
  OrganizationUserFactory,
} from '../../test/util/factories';
import {
  AccountType,
  OrganizationRole,
  OrgRoleChangeReason,
} from '@koh/common';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { MailService } from 'mail/mail.service';
import { MailModule } from 'mail/mail.module';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationService } from '../organization/organization.service';
import { RedisProfileModule } from '../redisProfile/redis-profile.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';

// Extend the OAuth2Client mock with additional methods
jest.mock('google-auth-library', () => {
  const actualLibrary = jest.requireActual('google-auth-library');

  class MockOAuth2Client extends actualLibrary.OAuth2Client {
    async getToken(code: string): Promise<any> {
      if (code === 'valid_code') {
        return Promise.resolve({ tokens: { id_token: 'valid_token' } });
      } else {
        return Promise.resolve({ tokens: { id_token: 'mocked_token' } });
      }
    }

    async verifyIdToken(options: any): Promise<any> {
      if (options.idToken !== 'valid_token') {
        return Promise.resolve({
          getPayload: () => ({
            email_verified: false,
            email: 'mocked_email@example.com',
            given_name: 'John',
            family_name: 'Doe',
            picture: 'mocked_picture_url',
          }),
        });
      } else {
        return Promise.resolve({
          getPayload: () => ({
            email_verified: true,
            email: 'mocked_email@example.com',
            given_name: 'John',
            family_name: 'Doe',
            picture: 'mocked_picture_url',
          }),
        });
      }
    }
  }

  return {
    OAuth2Client: MockOAuth2Client,
  };
});

class MockMailService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendUserVerificationCode(
    code: string,
    receiver: string,
  ): Promise<void> {
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendPasswordResetEmail(receiver: string, url: string): Promise<void> {
    return;
  }
}

describe('AuthService', () => {
  let service: AuthService;
  let dataSource: DataSource;
  let mailService: MailService;
  let roleChangeSpy: jest.SpyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        MailModule,
        OrganizationModule,
        RedisProfileModule,
        RedisModule.forRoot({
          readyLog: true,
          errorLog: true,
          commonOptions: {
            host: process.env.REDIS_HOST || 'localhost',
            port: 6379,
          },
          config: [
            {
              namespace: 'db',
            },
            {
              namespace: 'sub',
            },
            {
              namespace: 'pub',
            },
          ],
        }),
      ],
      providers: [
        AuthService,
        OrganizationService,
        RedisProfileModule,
        { provide: MailService, useClass: MockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mailService = module.get<MailService>(MailService);
    dataSource = module.get<DataSource>(DataSource);

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
    roleChangeSpy = jest.spyOn(OrganizationService.prototype, 'addRoleHistory');
  });

  afterEach(() => {
    roleChangeSpy?.mockRestore();
  });

  describe('loginWithShibboleth', () => {
    afterEach(() => {
      roleChangeSpy?.mockClear();
    });

    it('should throw an error when user already exists with password', async () => {
      await UserModel.create({
        email: 'mocked_email@example.com',
        password: 'test_password',
      }).save();

      await expect(
        service.loginWithShibboleth(
          'mocked_email@example.com',
          'John',
          'Doe',
          1,
        ),
      ).rejects.toThrowError(
        'A non-SSO account already exists with this email. Please login with your email and password instead.',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should throw an error when user already exists with other account type', async () => {
      await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.GOOGLE,
      }).save();

      await expect(
        service.loginWithShibboleth(
          'mocked_email@example.com',
          'John',
          'Doe',
          1,
        ),
      ).rejects.toThrowError(
        'A non-SSO account already exists with this email. Please login with your email and password instead.',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should return user id when user already exists without password', async () => {
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.SHIBBOLETH,
      }).save();

      const userId = await service.loginWithShibboleth(
        'mocked_email@example.com',
        'John',
        'Doe',
        1,
      );
      expect(userId).toEqual(user.id);
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should create a new user when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.loginWithShibboleth(
        'mocked_email@example.com',
        'John',
        'Doe',
        organization.id,
      );
      const user = await UserModel.findOne({
        where: {
          id: userId,
        },
        relations: {
          organizationUser: true,
        },
      });
      expect(user).toMatchSnapshot();
      expect(roleChangeSpy).toHaveBeenCalledTimes(1);
      expect(roleChangeSpy).toHaveBeenCalledWith(
        organization.id,
        null,
        OrganizationRole.MEMBER,
        null,
        user.organizationUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );
    });
  });

  describe('loginWithGoogle', () => {
    afterEach(() => {
      roleChangeSpy?.mockClear();
    });

    it('should throw an error when email is not verified', async () => {
      await expect(service.loginWithGoogle('invalid_token', 1)).rejects.toThrow(
        'Email not verified',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should throw an error when user already exists with password', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        password: 'test_password',
      }).save();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: organization,
      });

      await expect(
        service.loginWithGoogle('valid_code', organization.id),
      ).rejects.toThrowError(
        'A non-SSO account already exists with this email. Please login with your email and password instead.',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should throw an error when user already exists with other account type', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.SHIBBOLETH,
      }).save();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: organization,
      });

      await expect(
        service.loginWithGoogle('valid_code', organization.id),
      ).rejects.toThrowError(
        'A non-google account already exists with this email on HelpMe. Please try logging in with your email and password instead (or another SSO provider)',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should return user id when user already exists without password', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.GOOGLE,
      }).save();
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization: organization,
      });

      const userId = await service.loginWithGoogle(
        'valid_code',
        organization.id,
      );
      expect(userId).toEqual(user.id);
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should create a new user when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.loginWithGoogle(
        'valid_code',
        organization.id,
      );
      const user = await UserModel.findOne({
        where: {
          id: userId,
        },
        relations: {
          organizationUser: true,
        },
      });
      expect(user).toMatchSnapshot();
      expect(roleChangeSpy).toHaveBeenCalledTimes(1);
      expect(roleChangeSpy).toHaveBeenCalledWith(
        organization.id,
        null,
        OrganizationRole.MEMBER,
        null,
        user.organizationUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );
    });
  });

  describe('studentIdExists', () => {
    it('should return false when student id does not exist in organization', async () => {
      const organization = await OrganizationFactory.create();

      const result = await service.studentIdExists(-1, organization.id);
      expect(result).toBe(false);
    });

    it('should return false when studnet id exists but in different organization', async () => {
      const organization = await OrganizationFactory.create();
      const otherOrganization = await OrganizationFactory.create();

      const user = await UserModel.create({
        email: 'test@email.com',
        sid: 123456789,
      }).save();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: otherOrganization.id,
      }).save();

      const result = await service.studentIdExists(user.sid, organization.id);
      expect(result).toBe(false);
    });

    it('should return true when student id exists in organization', async () => {
      const organization = await OrganizationFactory.create();

      const user = await UserModel.create({
        email: 'test@email.com',
        sid: 123456789,
      }).save();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const result = await service.studentIdExists(user.sid, organization.id);
      expect(result).toBe(true);
    });
  });

  describe('register', () => {
    afterEach(() => {
      roleChangeSpy?.mockClear();
    });

    it('should throw an error when email already exists', async () => {
      await UserModel.create({
        email: 'existingEmail@mail.com',
      }).save();

      await expect(
        service.register(
          'John',
          'Doe',
          'existingEmail@mail.com',
          'password',
          -1,
          1,
        ),
      ).rejects.toThrowError('Email already exists');
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should create a new user when email does not exist with empty sid', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.register(
        'John',
        'Doe',
        'email@mail.com',
        'password',
        -1,
        organization.id,
      );

      const user = await UserModel.findOne({
        where: {
          id: userId,
        },
        relations: {
          organizationUser: true,
        },
      });
      expect(userId == user.id).toBe(true);
      expect(roleChangeSpy).toHaveBeenCalledTimes(1);
      expect(roleChangeSpy).toHaveBeenCalledWith(
        organization.id,
        null,
        OrganizationRole.MEMBER,
        null,
        user.organizationUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );
    });

    it('should create a new user when email does not exist with sid', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.register(
        'John',
        'Doe',
        'email@mail.com',
        'password',
        123456,
        organization.id,
      );

      const user = await UserModel.findOne({
        where: {
          id: userId,
        },
        relations: {
          organizationUser: true,
        },
      });
      expect(userId == user.id).toBe(true);
      expect(user.sid).toBe(123456);
      expect(roleChangeSpy).toHaveBeenCalledTimes(1);
      expect(roleChangeSpy).toHaveBeenCalledWith(
        organization.id,
        null,
        OrganizationRole.MEMBER,
        null,
        user.organizationUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );
    });

    it('should throw an error when unexpected error occurs', async () => {
      await expect(
        service.register('John', 'Doe', 'email@mail.com', 'password', -1, 1),
      ).rejects.toThrow();
    });
  });
});
