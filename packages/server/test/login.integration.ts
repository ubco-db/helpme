import { JwtService } from '@nestjs/jwt';
import { LoginModule } from '../src/login/login.module';
import { OrganizationFactory, UserFactory } from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import * as bcrypt from 'bcrypt';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import '@koh/common';

jest.mock('@koh/common', () => ({
  ...jest.requireActual('@koh/common'),
  isProd: () => true,
}));

jest.mock('superagent', () => ({
  post: jest.fn().mockImplementation((url) => {
    if (url.includes('invalid')) {
      return { body: { success: false } };
    }
    return { body: { success: true } };
  }),
}));

describe('Login Integration', () => {
  let jwtService: JwtService;

  const { supertest, getTestModule } = setupIntegrationTest(LoginModule);

  beforeAll(() => {
    jwtService = getTestModule().get<JwtService>(JwtService);
  });

  describe('POST /login', () => {
    it('returns 400 if no email is provided', async () => {
      await supertest()
        .post('/login')
        .send({ password: 'fake_password', recaptchaToken: 'token' })
        .expect(400);
    });

    it('returns 400 if recaptcha returned response false', async () => {
      await supertest()
        .post('/login')
        .send({
          email: 'fake_email@ubc.ca',
          password: 'fake_password',
          recaptchaToken: 'invalid',
        })
        .expect(400);
    });

    it('returns 404 if user not found', async () => {
      await supertest()
        .post('/login')
        .send({
          email: 'fake_email@ubc.ca',
          password: 'fake_password',
          recaptchaToken: 'token',
        })
        .expect(404);
    });

    it('returns 401 if password is incorrect', async () => {
      const user = await UserFactory.create({ password: 'real_password' });

      await supertest()
        .post('/login')
        .send({
          email: user.email,
          password: 'invalid_password',
          recaptchaToken: 'token',
        })
        .expect(401);
    });

    it('returns 403 if account is deactivated', async () => {
      const salt = await bcrypt.genSalt(10);
      const password = await bcrypt.hash('realpassword', salt);

      const user = await UserFactory.create({
        password: password,
        accountDeactivated: true,
      });

      await supertest()
        .post('/login')
        .send({
          email: user.email,
          password: 'realpassword',
          recaptchaToken: 'token',
        })
        .expect(403);
    });

    it('returns 200 if password is correct', async () => {
      const salt = await bcrypt.genSalt(10);
      const password = await bcrypt.hash('realpassword', salt);

      const user = await UserFactory.create({ password: password });

      const res = await supertest().post('/login').send({
        email: user.email,
        password: 'realpassword',
        recaptchaToken: 'token',
      });

      const token = '' + res.body.token;
      const decoded = jwtService.decode(token);
      expect(decoded).toEqual({
        userId: user.id,
        exp: expect.any(Number),
        iat: expect.any(Number),
      });
      delete res.body.token;
      expect(res.body).toMatchSnapshot();
      expect(res.status).toBe(200);
    });

    it('returns 405 when organization does not allow legacy auth', async () => {
      const organization = await OrganizationFactory.create({
        legacyAuthEnabled: false,
      });
      const user = await UserFactory.create({ password: 'real_password' });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await supertest()
        .post('/login')
        .send({
          email: user.email,
          password: 'real_password',
          recaptchaToken: 'token',
        })
        .expect(405);
    });

    it('returns 418 when user did not sign up with legacy account system', async () => {
      const organization = await OrganizationFactory.create({
        legacyAuthEnabled: true,
      });
      const user = await UserFactory.create({ password: null });

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      await jwtService.signAsync({ userId: user.id });

      await supertest()
        .post('/login')
        .send({
          email: user.email,
          password: 'real_password',
          recaptchaToken: 'token',
        })
        .expect(400);
    });
  });

  describe('POST /login/entry', () => {
    it('request to entry with correct jwt payload works', async () => {
      const user = await UserFactory.create();
      const token = await jwtService.signAsync({ userId: user.id });

      const res = await supertest()
        .get(`/login/entry?token=${token}`)
        .expect(302);

      expect(res.header['location']).toBe('/courses');

      const cookie = res.get('Set-Cookie')[0];
      const mainPart = cookie.substring(0, cookie.indexOf(';'));
      const secondPart = cookie.substring(cookie.indexOf(';') + 1);
      const [name, value] = mainPart.split('=');

      expect(name).toEqual('auth_token');

      const jwtToken = jwtService.decode(value);

      expect(jwtToken).toEqual(
        expect.objectContaining({
          userId: user.id,
          expiresIn: 24 * 30 * 60 * 60,
          iat: expect.anything(),
        }),
      );

      const parts = secondPart.split(';').map((v) => v.trim());
      const flags = parts.slice(1);

      expect(flags).toHaveLength(1);
      expect(flags[0]).toBe('HttpOnly');
    });

    it('request to entry with invalid jwt returns error', async () => {
      const user = await UserFactory.create();
      const token = await jwtService.signAsync({ userId: user.id });

      const spy = jest.spyOn(JwtService.prototype, 'verifyAsync');
      spy.mockResolvedValue(null);

      await supertest().get(`/login/entry?token=${token}`).expect(401);

      spy.mockRestore();
    });
  });

  describe('GET /logout', () => {
    it('makes sure logout endpoint is destroying cookies like a mob boss', async () => {
      const res = await supertest().get(`/logout`).expect(302);
      expect(res.header['location']).toBe('/login');
      expect(res.get('Set-Cookie')[0]).toContain('auth_token=;');
    });
  });
});
