import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { UserModel } from 'profile/user.entity';
import { Connection } from 'typeorm';
import { OrganizationFactory } from '../../test/util/factories';
import { AccountType } from '@koh/common';
import { MailService } from 'mail/mail.service';
import { MailModule } from 'mail/mail.module';

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
  let conn: Connection;
  let mailService: MailService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, MailModule],
      providers: [
        AuthService,
        { provide: MailService, useClass: MockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mailService = module.get<MailService>(MailService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  describe('loginWithShibboleth', () => {
    it('should throw an error when user already exists with password', async () => {
      const org = await OrganizationFactory.create();
      await UserModel.create({
        email: 'mocked_email@example.com',
        password: 'test_password',
        organizationId: org.id,
      }).save();

      await expect(
        service.loginWithShibboleth(
          'mocked_email@example.com',
          'student@ubc.ca',
          'John',
          'Doe',
          1,
        ),
      ).rejects.toThrowError(
        'User collisions with legacy account are not allowed',
      );
    });

    it('should throw an error when user already exists with other account type', async () => {
      const org = await OrganizationFactory.create();
      await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.GOOGLE,
        organizationId: org.id,
      }).save();

      await expect(
        service.loginWithShibboleth(
          'mocked_email@example.com',
          'student@ubc.ca',
          'John',
          'Doe',
          1,
        ),
      ).rejects.toThrowError(
        'User collisions with other account types are not allowed',
      );
    });

    it('should return user id when user already exists without password', async () => {
      const org = await OrganizationFactory.create();
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.SHIBBOLETH,
        organizationId: org.id,
      }).save();

      const userId = await service.loginWithShibboleth(
        'mocked_email@example.com',
        'student@ubc.ca',
        'John',
        'Doe',
        1,
      );
      expect(userId).toEqual(user.id);
    });

    it('should create a new user when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.loginWithShibboleth(
        'mocked_email@example.com',
        'student@ubc.ca',
        'John',
        'Doe',
        organization.id,
      );
      const user = await UserModel.findOne(userId);
      expect(user).toMatchSnapshot();
    });
  });

  describe('loginWithGoogle', () => {
    it('should throw an error when email is not verified', async () => {
      await expect(service.loginWithGoogle('invalid_token', 1)).rejects.toThrow(
        'Email not verified',
      );
    });

    it('should throw an error when user already exists with password', async () => {
      const organization = await OrganizationFactory.create();
      await UserModel.create({
        email: 'mocked_email@example.com',
        password: 'test_password',
        organizationId: organization.id,
      }).save();

      await expect(
        service.loginWithGoogle('valid_code', organization.id),
      ).rejects.toThrowError(
        'User collisions with legacy account are not allowed',
      );
    });

    it('should throw an error when user already exists with other account type', async () => {
      const organization = await OrganizationFactory.create();
      await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.SHIBBOLETH,
        organizationId: organization.id,
      }).save();

      await expect(
        service.loginWithGoogle('valid_code', organization.id),
      ).rejects.toThrowError(
        'User collisions with other account types are not allowed',
      );
    });

    it('should return user id when user already exists without password', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserModel.create({
        email: 'mocked_email@example.com',
        accountType: AccountType.GOOGLE,
        organizationId: organization.id,
      }).save();

      const userId = await service.loginWithGoogle(
        'valid_code',
        organization.id,
      );
      expect(userId).toEqual(user.id);
    });

    it('should create a new user when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.loginWithGoogle(
        'valid_code',
        organization.id,
      );
      const user = await UserModel.findOne(userId);
      expect(user).toMatchSnapshot();
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
        organizationId: organization.id,
      }).save();

      const result = await service.studentIdExists(user.sid, organization.id);
      expect(result).toBe(true);
    });
  });

  describe('register', () => {
    it('should throw an error when email already exists', async () => {
      const org = await OrganizationFactory.create();
      await UserModel.create({
        email: 'existingEmail@mail.com',
        organizationId: org.id,
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

      const user = await UserModel.findOne(userId);
      expect(userId == user.id).toBe(true);
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

      const user = await UserModel.findOne(userId);

      expect(userId == user.id).toBe(true);
      expect(user.sid).toBe(123456);
    });

    it('should throw an error when unexpected error occurs', async () => {
      await expect(
        service.register('John', 'Doe', 'email@mail.com', 'password', -1, 1),
      ).rejects.toThrowError;
    });
  });
});
