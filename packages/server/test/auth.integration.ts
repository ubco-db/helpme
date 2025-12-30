import { AuthModule } from 'auth/auth.module';
import { setupIntegrationTest } from './util/testUtils';
import { JwtService } from '@nestjs/jwt';
import {
  AuthStateFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserFactory,
} from './util/factories';
import { AuthService } from 'auth/auth.service';
import { AccountType } from '@koh/common';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';
import { LoginTicket, OAuth2Client } from 'google-auth-library';

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(
    (...params) =>
      ({
        ...params,
        getToken: jest.fn().mockResolvedValue({ tokens: [] }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload() {
            return {
              email: 'mock_user@email.com',
              email_verified: true,
            } as any;
          },
        } as unknown as LoginTicket),
      }) as unknown as OAuth2Client,
  ),
}));

jest.mock('superagent', () => ({
  post: jest.fn().mockImplementation((url) => {
    if (url.includes('invalid')) {
      return { body: { success: false } };
    }
    return { body: { success: true } };
  }),
}));

describe('Auth Integration', () => {
  let jwtService: JwtService;
  let authService: AuthService;
  const { supertest, getTestModule } = setupIntegrationTest(AuthModule);

  beforeEach(async () => {
    const testModule = getTestModule();

    authService = testModule.get<AuthService>(AuthService);
    jwtService = testModule.get<JwtService>(JwtService);
  });

  describe('GET link/:method', () => {
    it('should return 400 if organization not found', async () => {
      const res = await supertest().get('/auth/link/google/0');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Organization not found');
    });

    it('should return 200 and redirect to google', async () => {
      const org = await OrganizationFactory.create();
      const res = await supertest().get(`/auth/link/google/${org.id}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET shibboleth/:oid', () => {
    it("should redirect to failed/40000 when organization doesn't exist", async () => {
      const res = await supertest().get('/auth/shibboleth/0');
      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/failed/40000');
    });

    it('should redirect to /failed/40002 when SSO is disabled', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: false,
      });
      const res = await supertest().get(`/auth/shibboleth/${organization.id}`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/failed/40002');
    });

    it('should redirect to login?error when headers are missing', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      const res = await supertest().get(`/auth/shibboleth/${organization.id}`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/login?error=errorCode400');
    });

    it('should redirect to login?error when authService failed', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });

      const spy = jest.spyOn(authService, 'loginWithShibboleth');
      spy.mockRejectedValue(new Error('some error'));

      const res = await supertest()
        .get(`/auth/shibboleth/${organization.id}`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'failing_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain(
        '/login?error=errorCode500some%20error',
      );
      spy.mockRestore();
    });

    it('should sign in user when authService succeeded', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      await UserFactory.create({
        email: 'mocked_email@ubc.ca',
        accountType: AccountType.SHIBBOLETH,
      });

      const res = await supertest()
        .get(`/auth/shibboleth/${organization.id}`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'mocked_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');

      await authService.loginWithShibboleth(
        'mocked_email@ubc.ca',
        'John',
        'Doe',
        organization.id,
      );

      await jwtService.signAsync({ userId: 1 });

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/courses');
    });

    it('should sign in and redirect to /invite when __SECURE_REDIRECT cookie is present', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      await UserFactory.create({
        email: 'mocked_email@ubc.ca',
        accountType: AccountType.SHIBBOLETH,
      });

      const res = await supertest()
        .get(`/auth/shibboleth/${organization.id}`)
        .set('Cookie', `__SECURE_REDIRECT=1,inviteCode`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'mocked_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');

      await authService.loginWithShibboleth(
        'mocked_email@ubc.ca',
        'John',
        'Doe',
        organization.id,
      );

      await jwtService.signAsync({ userId: 1 });

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/invite?cid=1&code=inviteCode');
    });
  });

  describe('GET callback/:method', () => {
    it.each(['', '?state='])(
      'should redirect to /lti/failed/40000 if auth state invalid or missing',
      async (end) => {
        const res = await supertest().get(`/auth/callback/google${end}`);

        expect(res.status).toBe(302);
        expect(res.header['location']).toContain('/failed/40003');
      },
    );

    it('should redirect to /lti/failed/40000 if auth state not found', async () => {
      const res = await supertest().get(`/auth/callback/google?state=abc`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/failed/40000');
    });

    it('should redirect to /failed/40002 if organization not enabled google auth', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: false,
      });
      const authState = await AuthStateFactory.create({
        organization,
      });

      const res = await supertest().get(
        `/auth/callback/google?state=${authState.state}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/failed/40002');
    });

    it('should redirect to /failed/40004 if auth state is expired', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization,
        expiresInSeconds: 0,
      });

      const res = await supertest().get(
        `/auth/callback/google?state=${authState.state}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/failed/40004');
    });

    it('should redirect to login?error when authService failed', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization,
      });
      const spy = jest.spyOn(authService, 'loginWithGoogle');
      spy.mockRejectedValue(new Error('Some error'));

      const res = await supertest().get(
        `/auth/callback/google?state=${authState.state}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain(
        '/login?error=errorCode500Some%20error',
      );
      spy.mockRestore();
    });

    it('should sign in user when authService succeeded', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization,
      });
      const res = await supertest()
        .get(`/auth/callback/google`)
        .query({ code: 'expectedCode', state: authState.state });

      await authService.loginWithGoogle('expectedCode', organization.id);
      await jwtService.signAsync({ userId: 1 });

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
        organizationUser: user,
        organization,
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

      await jwtService.signAsync({ userId: 1 });

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
        expiresInSeconds: 0,
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
        expiresInSeconds: 0,
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
      const res = await supertest({ userId: user.id })
        .post('/auth/registration/verify')
        .send({
          token: 'invalid',
        });

      expect(res.body.message).toBe(
        'Verification code was not found or it is not valid',
      );
      expect(res.status).toBe(400);
    });

    it('should return BAD REQUEST when token has expired', async () => {
      const user = await UserFactory.create();
      const userToken = await UserTokenModel.create({
        user,
        token: 'expired',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        expiresInSeconds: 0,
      }).save();

      const res = await supertest({ userId: user.id })
        .post('/auth/registration/verify')
        .send({
          token: userToken.token,
        });

      expect(res.body.message).toBe('Verification code has expired');
      expect(res.status).toBe(400);
    });

    it('should return ACCEPTED when token is valid', async () => {
      const user = await UserFactory.create();

      const userToken = await UserTokenModel.create({
        user,
        token: 'valid',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
      }).save();

      const res = await supertest({ userId: user.id })
        .post('/auth/registration/verify')
        .send({
          token: userToken.token,
        });

      expect(res.status).toBe(202);
    });

    it('should return TEMPORARY REDIRECT when __SECURE_REDIRECT cookie is present', async () => {
      const user = await UserFactory.create();

      const userToken = await UserTokenModel.create({
        user,
        token: 'valid',
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
      }).save();

      const token = jwtService.sign({ userId: user.id });
      const res = await supertest()
        .post('/auth/registration/verify')
        .set(
          'Cookie',
          `auth_token=${token};__SECURE_REDIRECT=${Buffer.from(`/course`).toString('base64')}`,
        )
        .send({
          token: userToken.token,
        });

      expect(res.status).toBe(307);
    });
  });
});
