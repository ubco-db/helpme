import { setupIntegrationTest } from './util/testUtils';
import { JwtService } from '@nestjs/jwt';
import {
  AuthStateFactory,
  CourseFactory,
  LtiCourseInviteFactory,
  LtiIdentityTokenFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { AuthService } from 'auth/auth.service';
import { AccountType } from '@koh/common';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { LtiModule } from '../src/lti/lti.module';
import { restrictPaths } from '../src/lti/lti-auth.controller';
import { UserCourseModel } from '../src/profile/user-course.entity';
import { UserLtiIdentityModel } from '../src/lti/user_lti_identity.entity';

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

describe('LTI Auth Integration', () => {
  let jwtService: JwtService;
  let authService: AuthService;
  const { supertest, getTestModule } = setupIntegrationTest(LtiModule);

  beforeEach(async () => {
    const testModule = getTestModule();

    authService = testModule.get<AuthService>(AuthService);
    jwtService = testModule.get<JwtService>(JwtService);
  });

  describe('POST /lti/auth/entry', () => {
    it('entry as user with courses goes to lti page', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({ user: user });
      const token = await jwtService.signAsync({ userId: user.id });

      const res = await supertest()
        .get(`/lti/auth/entry?token=${token}`)
        .expect(302);

      expect(res.header['location']).toBe('/lti');

      const cookie = res.get('Set-Cookie')[0];
      const mainPart = cookie.substring(0, cookie.indexOf(';'));
      const secondPart = cookie.substring(cookie.indexOf(';') + 1);
      const [name, value] = mainPart.split('=');

      expect(name).toEqual('lti_auth_token');

      const jwtToken = jwtService.decode(value);

      expect(jwtToken).toEqual(
        expect.objectContaining({
          userId: user.id,
          restrictPaths,
          expiresIn: 10 * 60,
          iat: expect.anything(),
        }),
      );

      const parts = secondPart.split(';').map((v) => v.trim());
      const flags = parts.slice(1);

      expect(flags).toHaveLength(3);
      expect(flags[0]).toBe('HttpOnly');
      expect(flags[1]).toBe('Secure');
      expect(flags[2]).toBe('SameSite=None');
    });

    it('should fail with 401 if token is invalid', async () => {
      const user = await UserFactory.create();
      const token = await jwtService.signAsync({ userId: user.id });

      const spy = jest.spyOn(JwtService.prototype, 'verifyAsync');
      spy.mockResolvedValue(null);

      await supertest().get(`/lti/auth/entry?token=${token}`).expect(401);

      spy.mockRestore();
    });
  });

  describe('GET /lti/auth/link/:method/:oid', () => {
    it('should return 400 if organization not found', async () => {
      const res = await supertest().get('/lti/auth/link/google/0');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Organization not found');
    });

    it('should return 200 and redirect to google', async () => {
      const org = await OrganizationFactory.create();
      const res = await supertest().get(`/lti/auth/link/google/${org.id}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /lti/auth/shibboleth/:oid', () => {
    it("should redirect to /lti/failed/40000 when organization doesn't exist", async () => {
      const res = await supertest().get('/lti/auth/shibboleth/0');
      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/lti/failed/40000');
    });

    it('should redirect to /lti/failed/40002 when SSO is disabled', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: false,
      });
      const res = await supertest().get(
        `/lti/auth/shibboleth/${organization.id}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/lti/failed/40002');
    });

    it('should redirect to /lti/login?error when headers are missing', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });
      const res = await supertest().get(
        `/lti/auth/shibboleth/${organization.id}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/lti/login?error=errorCode400');
    });

    it('should redirect to login?error when authService failed', async () => {
      const organization = await OrganizationFactory.create({
        ssoEnabled: true,
      });

      const spy = jest.spyOn(AuthService.prototype, 'loginWithShibboleth');
      spy.mockRejectedValue(new Error('some error'));

      const res = await supertest()
        .get(`/lti/auth/shibboleth/${organization.id}`)
        .set('x-trust-auth-uid', '1')
        .set('x-trust-auth-mail', 'failing_email@ubc.ca')
        .set('x-trust-auth-role', 'student@ubc.ca')
        .set('x-trust-auth-givenname', 'John')
        .set('x-trust-auth-lastname', 'Doe');
      spy.mockRestore();
      expect(res.status).toBe(302);
      expect(res.header['location']).toContain(
        '/lti/login?error=errorCode500some%20error',
      );
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
        .get(`/lti/auth/shibboleth/${organization.id}`)
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
      expect(res.header['location']).toBe('/lti?force_close=true');
    });
  });

  describe('GET /lti/auth/callback/:method', () => {
    it.each(['', '?state='])(
      'should redirect to /lti/failed/40000 if auth state parameter invalid or not found',
      async (end) => {
        const res = await supertest().get(`/lti/auth/callback/google${end}`);

        expect(res.status).toBe(302);
        expect(res.header['location']).toContain('/lti/failed/40003');
      },
    );

    it('should redirect to /lti/failed/40000 if matching auth state not found', async () => {
      const res = await supertest().get(`/lti/auth/callback/google?state=abc`);

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/lti/failed/40000');
    });

    it('should redirect to /lti/failed/40002 if organization not enabled google auth', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: false,
      });
      const authState = await AuthStateFactory.create({
        organization,
      });

      const res = await supertest().get(
        `/lti/auth/callback/google?state=${authState.state}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/lti/failed/40002');
    });

    it('should redirect to /lti/failed/40004 if auth state expired', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization,
        expiresInSeconds: 0,
      });

      const res = await supertest().get(
        `/lti/auth/callback/google?state=${authState.state}`,
      );

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain('/lti/failed/40004');
    });

    it('should redirect to /lti/login?error when authService failed', async () => {
      const organization = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization,
      });
      const spy = jest.spyOn(AuthService.prototype, 'loginWithGoogle');
      spy.mockRejectedValue(new Error('Some error'));

      const res = await supertest().get(
        `/lti/auth/callback/google?state=${authState.state}`,
      );

      spy.mockRestore();

      expect(res.status).toBe(302);
      expect(res.header['location']).toContain(
        '/lti/login?error=errorCode500Some%20error',
      );
    });

    it('should sign in user when authService succeeded', async () => {
      const organization = await OrganizationFactory.create();
      const authState = await AuthStateFactory.create({
        organization,
      });
      const res = await supertest()
        .get(`/lti/auth/callback/google`)
        .query({ code: 'expectedCode', state: authState.state });

      await authService.loginWithGoogle('expectedCode', organization.id);
      await jwtService.signAsync({ userId: 1 });

      expect(res.status).toBe(302);
      expect(res.header['location']).toBe('/lti?force_close=true');
    });
  });

  describe('POST /lti/auth/register', () => {
    it('should return BAD REQUEST when Google returned false for recaptcha', () => {
      return supertest()
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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
        .post('/lti/auth/register')
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

      const res = await supertest().post('/lti/auth/register').send({
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

      const res = await supertest().post('/lti/auth/register').send({
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

      const res = await supertest().post('/lti/auth/register').send({
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

    it('should return cookie with auth_token and create course enrollment if cookie is present when user is registered', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });

      const courseInvite = await LtiCourseInviteFactory.create({
        email: 'email@email.com',
        course: course,
      });

      const token = jwtService.sign({
        courseId: course.id,
        email: courseInvite.email,
        inviteCode: courseInvite.inviteCode,
      });

      const res = await supertest()
        .post('/lti/auth/register')
        .set('Cookie', `__COURSE_INVITE=${token}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email@email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 2,
          organizationId: organization.id,
          recaptchaToken: 'token',
        });

      const { userId } = await jwtService.verify(
        res
          .get('Set-Cookie')[1]
          .substring(
            'lti_auth_token='.length,
            res.get('Set-Cookie')[1].indexOf(';'),
          ),
      );
      expect(
        await UserCourseModel.findOne({
          where: {
            courseId: course.id,
            userId,
          },
        }),
      ).toBeDefined();

      expect(res.status).toBe(201);
      expect(res.get('Set-Cookie')[1]).toContain('lti_auth_token');
    });

    it('should return cookie with auth_token and create user-lti-identity if cookie is present when user is registered', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });

      const identityToken = await LtiIdentityTokenFactory.create({
        ltiUserId: '0',
      });

      const token = jwtService.sign({
        code: identityToken.code,
      });

      const res = await supertest()
        .post('/lti/auth/register')
        .set('Cookie', `__LTI_IDENTITY=${token}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'email@email.com',
          password: 'password',
          confirmPassword: 'password',
          sid: 2,
          organizationId: organization.id,
          recaptchaToken: 'token',
        });

      const { userId } = await jwtService.verify(
        res
          .get('Set-Cookie')[0]
          .substring(
            'lti_auth_token='.length,
            res.get('Set-Cookie')[0].indexOf(';'),
          ),
      );
      expect(
        await UserLtiIdentityModel.findOne({
          where: {
            userId,
            issuer: identityToken.issuer,
          },
        }),
      ).toBeDefined();

      expect(res.status).toBe(201);
      expect(res.get('Set-Cookie')[0]).toContain('lti_auth_token');
    });
  });

  describe('POST /lti/auth/password/reset', () => {
    it('should return BAD REQUEST when Google returned false for recaptcha', () => {
      return supertest()
        .post('/lti/auth/password/reset')
        .send({
          email: 'email.com',
          recaptchaToken: 'invalid',
          organizationId: 1,
        })
        .expect(400);
    });

    it('should return BAD REQUEST when user does not exist', async () => {
      const organization = await OrganizationFactory.create();

      const res = await supertest().post('/lti/auth/password/reset').send({
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

      const res = await supertest().post('/lti/auth/password/reset').send({
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

      const res = await supertest().post('/lti/auth/password/reset').send({
        email: user.email,
        recaptchaToken: 'token',
        organizationId: organization.id,
      });

      expect(res.status).toBe(202);
    });
  });
});
