/* eslint-disable @typescript-eslint/no-unused-vars */
import { AuthModule } from 'auth/auth.module';
import { setupIntegrationTest } from './util/testUtils';
import { TestingModuleBuilder } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  OrganizationFactory,
  OrganizationUserFactory,
  UserFactory,
} from './util/factories';
import { AuthService } from 'auth/auth.service';
import { AccountType } from '@koh/common';
import { MailService } from 'mail/mail.service';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserModel } from 'profile/user.entity';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { ExecutionContext, Injectable } from '@nestjs/common';

const mockJWT = {
  signAsync: async (payload) => JSON.stringify(payload),
  verifyAsync: async (payload) => JSON.parse(payload).token !== 'INVALID_TOKEN',
  decode: (payload) => JSON.parse(payload),
};

jest.mock('superagent', () => ({
  post: jest.fn().mockImplementation((url) => {
    if (url.includes('invalid')) {
      return { body: { success: false } };
    }
    return { body: { success: true } };
  }),
}));

const mockAuthService = {
  // Needed to mock the AuthService
  loginWithGoogle: async (code: string, _organizationId: number) => {
    if (code === 'expectedCode') {
      return 1;
    } else {
      throw new Error('Some error');
    }
  },

  loginWithShibboleth: async (
    mail: string,
    _role: string,
    _givenName: string,
    _lastName: string,
    _organizationId: number,
  ): Promise<number> => {
    if (mail == 'failing_email@ubc.ca') {
      throw new Error('Some error');
    }
    return 1;
  },

  studentIdExists: async (sid: number, organizationId: number) => {
    if (sid === 1 && organizationId === 1) {
      return true;
    }
    return false;
  },

  register: async (
    _firstName: string,
    _lastName: string,
    _email: string,
    _password: string,
    _sid: number,
    _organizationId: number,
  ) => {
    return 1;
  },

  createPasswordResetToken: async (_user: UserModel) => {
    return 'reset_link';
  },
};

const mockMailService = {
  sendPasswordResetEmail: async (_email: string, _url: string) => {
    return;
  },
  sendUserVerificationCode: async (_email: string, _receiver: string) => {
    return;
  },
};

@Injectable()
export class MockJwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const mockUser = { userId: 1 };
    const request = context.switchToHttp().getRequest();
    request.user = mockUser;
    return true;
  }
}

describe('Auth Integration', () => {
  const supertest = setupIntegrationTest(
    AuthModule,
    (t: TestingModuleBuilder) =>
      t
        .overrideProvider(JwtService)
        .useValue(mockJWT)
        .overrideProvider(AuthService)
        .useValue(mockAuthService)
        .overrideProvider(MailService)
        .useValue(mockMailService)
        .overrideGuard(JwtAuthGuard)
        .useClass(MockJwtAuthGuard),
  );

  describe('GET link/:method/:oid', () => {
    it('should return 200 and redirect to google', async () => {
      const res = await supertest().get('/auth/link/google/1');

      expect(res.status).toBe(200);
      expect(res.get('Set-Cookie')[0]).toContain('organization.id=1;');
    });
  });

  describe('GET shibboleth/:oid', () => {
    it("should redirect to auth/failed/40000 when organization doesn't exist", async () => {
      const res = await supertest().get('/auth/shibboleth/0');
      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40000');
    });

    it('should redirect to auth/failed/40002 when SSO is disabled', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: false,
      });
      const res = await supertest().get(`/auth/shibboleth/${organization.id}`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40002');
    });

    it('should redirect to auth/failed/40001 when headers are missing', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      const res = await supertest().get(`/auth/shibboleth/${organization.id}`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40001');
    });

    it('should redirect to auth/failed/40001 when authService failed', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });

      const res = await supertest()
        .get(`/auth/shibboleth/${organization.id}`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'failing_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40001');
    });

    it('should sign in user when authService succeeded', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      await UserFactory.create({
        email: 'mocked_email@ubc.ca',
        accountType: AccountType.GOOGLE,
      });
      const res = await supertest()
        .get(`/auth/shibboleth/${organization.id}`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'mocked_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');

      await mockAuthService.loginWithShibboleth(
        'mocked_email@ubc.ca',
        'student@ubc.ca',
        'John',
        'Doe',
        organization.id,
      );

      await mockJWT.signAsync({ userId: 1 });

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/courses');
    });
  });

  describe('GET callback/:method', () => {
    it('should redirect to /auth/failed/40000 when cookie is missing', async () => {
      const res = await supertest().get('/auth/callback/google');

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40000');
    });

    it('should redirect to /auth/failed/40001 when authService failed', async () => {
      const res = await supertest()
        .get('/auth/callback/google')
        .set('Cookie', 'organization.id=1');

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/auth/failed/40001');
    });

    it('should sign in user when authService succeeded', async () => {
      const organization = await OrganizationFactory.create();
      const res = await supertest()
        .get('/auth/callback/google')
        .set('Cookie', `organization.id=${organization.id}`)
        .query({ code: 'expectedCode' });

      await mockAuthService.loginWithGoogle('expectedCode', organization.id);
      await mockJWT.signAsync({ userId: 1 });

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/courses');
    });
  });

  describe('POST register', () => {
    it('should return BAD REQUEST when Google returned false for recaptcha', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'invalid',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when firstName is shorter than 1 character', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: '',
          lastName: 'Doe',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when firsName is longer than 32 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'a'.repeat(33),
          lastName: 'Doe',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when lastName is shorter than 1 character', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: '',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when lastName is longer than 32 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'a'.repeat(33),
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when email is shorter than 4 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'a@b.c',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when email is longer than 64 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'a'.repeat(65) + '@b.c',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when password is shorter than 6 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email.com',
          password: '12345',
          confirmPassword: '12345',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when password is longer than 32 characters', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email.com',
          password: 'a'.repeat(33),
          confirmPassword: 'a'.repeat(33),
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when passwords do not match', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password1',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when organization does not exist', () => {
      return supertest()
        .post('/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 1,
          organizationId: 1,
          recaptchaToken: 'token',
        })
        .expect(400);
    });

    it('should return BAD REQUEST when email already exists', async () => {
      const organization = await OrganizationFactory.create();
      await UserFactory.create({
        email: 'email@email.com',
      });

      const res = await supertest().post('/auth/register').send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'email@email.com',
        password: 'password',
        confirmPassword: 'password',
        sid: 1,
        organizationId: organization.id,
        recaptchaToken: 'token',
      });

      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when student id exists in organization', async () => {
      const organization = await OrganizationFactory.create();

      const user = await UserFactory.create({
        email: 'user@email.com',
        sid: 1,
      });

      await OrganizationUserFactory.create({
        userId: user.id,
        organizationId: organization.id,
      });

      const res = await supertest().post('/auth/register').send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'new@email.com',
        password: 'password',
        confirmPassword: 'password',
        sid: 1,
        organizationId: organization.id,
        recaptchaToken: 'token',
      });

      expect(res.status).toBe(400);
    });

    it('should return cookie with auth_token when user is registered', async () => {
      const organization = await OrganizationFactory.create();

      await mockJWT.signAsync({ userId: 1 });

      const res = await supertest().post('/auth/register').send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'email@email.com',
        password: 'password',
        confirmPassword: 'password',
        sid: 2,
        organizationId: organization.id,
        recaptchaToken: 'token',
      });

      expect(res.status).toBe(201);
      expect(res.get('Set-Cookie')[0]).toContain('auth_token');
    });
  });

  describe('POST password/reset', () => {
    it('should return BAD REQUEST when Google returned false for recaptcha', () => {
      return supertest()
        .post('/auth/password/reset')
        .send({
          email: 'email.com',
          recaptchaToken: 'invalid',
          organizationId: 1,
        })
        .expect(400);
    });

    it('should return BAD REQUEST when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const res = await supertest().post('/auth/password/reset').send({
        email: 'email.com',
        recaptchaToken: 'token',
        organizationId: organization.id,
      });

      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when email is not verified', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserFactory.create({
        email: 'email.com',
        emailVerified: false,
      });

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: user.id,
      }).save();

      const res = await supertest().post('/auth/password/reset').send({
        email: user.email,
        recaptchaToken: 'token',
        organizationId: organization.id,
      });

      expect(res.status).toBe(400);
    });

    it('should return ACCEPTED when email is sent', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserFactory.create({
        email: 'email.com',
        emailVerified: true,
      });

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: user.id,
      }).save();

      const res = await supertest().post('/auth/password/reset').send({
        email: user.email,
        recaptchaToken: 'token',
        organizationId: organization.id,
      });

      expect(res.status).toBe(202);
    });
  });

  describe('POST password/reset/:token', () => {
    it('should return BAD REQUEST when password and confirmPassword do not match', async () => {
      const res = await supertest().post('/auth/password/reset/123').send({
        password: 'password',
        confirmPassword: 'password1',
      });

      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when token is invalid', async () => {
      const res = await supertest().post('/auth/password/reset/invalid').send({
        password: 'password',
        confirmPassword: 'password',
      });

      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when token is expired', async () => {
      const user = await UserFactory.create();
      const userToken = await UserTokenModel.create({
        user,
        token: 'expired',
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()) - 10_000,
        expires_at: parseInt(new Date().getTime().toString()) - 10_000,
      }).save();

      const res = await supertest()
        .post(`/auth/password/reset/${userToken.token}`)
        .send({
          password: 'password',
          confirmPassword: 'password',
        });

      expect(res.status).toBe(400);
    });

    it('should return ACCEPTED when token is valid', async () => {
      const user = await UserFactory.create();
      const userToken = await UserTokenModel.create({
        user,
        token: 'valid',
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()),
        expires_at: parseInt(new Date().getTime().toString()) + 20_000,
      }).save();

      const res = await supertest()
        .post(`/auth/password/reset/${userToken.token}`)
        .send({
          password: 'password',
          confirmPassword: 'password',
        });

      expect(res.status).toBe(202);
    });
  });

  describe('GET password/reset/validate/:token', () => {
    it('should return BAD REQUEST when token not found', async () => {
      const res = await supertest().get(
        '/auth/password/reset/validate/invalid',
      );

      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when token is expired', async () => {
      const user = await UserFactory.create();
      const userToken = await UserTokenModel.create({
        user,
        token: 'expired',
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()) - 10_000,
        expires_at: parseInt(new Date().getTime().toString()) - 10_000,
      }).save();

      const res = await supertest().get(
        `/auth/password/reset/validate/${userToken.token}`,
      );

      expect(res.body.message).toBe('Password reset token has expired');
      expect(res.status).toBe(400);
    });

    it('should return ACCEPTED when token is valid', async () => {
      const user = await UserFactory.create();
      const userToken = await UserTokenModel.create({
        user,
        token: 'valid',
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()),
        expires_at: parseInt(new Date().getTime().toString()) + 20_000,
      }).save();

      const res = await supertest().get(
        `/auth/password/reset/validate/${userToken.token}`,
      );

      expect(res.status).toBe(202);
    });
  });

  describe('POST registration/verify', () => {
    it('should return BAD REQUEST when token not found', async () => {
      const user = await UserFactory.create();
      await mockJWT.signAsync({ userId: user.id });
      const res = await supertest().post('/auth/registration/verify').send({
        token: 'invalid',
      });

      expect(res.body.message).toBe(
        'Verification code was not found or it is not valid',
      );
      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when token has expired', async () => {
      const user = await UserFactory.create();
      await mockJWT.signAsync({ userId: user.id });
      const userToken = await UserTokenModel.create({
        user,
        token: 'expired',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()) - 10_000,
        expires_at: parseInt(new Date().getTime().toString()) - 10_000,
      }).save();

      const res = await supertest().post('/auth/registration/verify').send({
        token: userToken.token,
      });

      expect(res.body.message).toBe('Verification code has expired');
      expect(res.status).toBe(400);
    });

    it('should return ACCEPTED when token is valid', async () => {
      const user = await UserFactory.create();
      await mockJWT.signAsync({ userId: user.id });

      const userToken = await UserTokenModel.create({
        user,
        token: 'valid',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        created_at: parseInt(new Date().getTime().toString()),
        expires_at: parseInt(new Date().getTime().toString()) + 20_000,
      }).save();

      const res = await supertest().post('/auth/registration/verify').send({
        token: userToken.token,
      });

      expect(res.status).toBe(202);
    });
  });
});
