import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PROD_URL } from '@koh/common';
import type { Request, Response } from 'express';
import { CourseService } from 'course/course.service';
import { LoginService } from '../login/login.service';
import {
  LTI_APP_SESSION_SECONDS,
  LtiAuthController,
  restrictPaths,
} from '../lti/lti-auth.controller';
import { LtiService } from '../lti/lti.service';
import { AuthService } from './auth.service';
import { DevSsoController } from './dev-sso.controller';
import { DevSsoService } from './dev-sso.service';
import * as supertest from 'supertest';

// Keep the real controllers, shared service, and guards without loading their
// database/external-service dependency graphs. Static cookie options are a fixture.
jest.mock('./auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('course/course.service', () => ({
  CourseService: class CourseService {},
}));
jest.mock('../login/login.service', () => ({
  LoginService: class LoginService {},
}));
jest.mock('../lti/lti.service', () => ({
  LtiService: class LtiService {
    static readonly cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    };
  },
}));

const regularBase = '/api/v1/dev-sso';
const ltiBase = '/api/v1/lti/auth/dev-sso';
const identity = {
  email: 'learner@example.edu',
  givenName: 'Ada',
  lastName: 'Lovelace',
};
const trustHeaders = {
  'x-trust-auth-mail': identity.email,
  'x-trust-auth-givenname': identity.givenName,
  'x-trust-auth-lastname': identity.lastName,
};
const ltiOptions = {
  cookieName: 'lti_auth_token',
  prefix: '/lti',
  restrictPaths,
  redirect: '/lti?force_close=true',
  cookieOptions: LtiService.cookieOptions,
  expiresIn: LTI_APP_SESSION_SECONDS,
};

describe('development SSO HTTP regressions', () => {
  let app: INestApplication;
  const originalDomain = process.env.DOMAIN;
  const courseService = {};
  const ltiService = {};
  const authService = {
    shibbolethAuthCallback: jest.fn(),
    ssoAuthInit: jest.fn(),
  };
  const loginService = { initLoginEnter: jest.fn() };
  const configService = { get: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [DevSsoController, LtiAuthController],
      providers: [
        DevSsoService,
        { provide: AuthService, useValue: authService },
        { provide: CourseService, useValue: courseService },
        { provide: LtiService, useValue: ltiService },
        { provide: LoginService, useValue: loginService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    process.env.DOMAIN = 'http://localhost:3000';
    jest.resetAllMocks();
    configService.get.mockImplementation(() => process.env.DOMAIN);
    authService.shibbolethAuthCallback.mockImplementation(
      async (_req: Request, res: Response) => {
        res.status(204).send();
      },
    );
    authService.ssoAuthInit.mockImplementation((res: Response) =>
      res.json({ redirectUri: '/real-idp' }),
    );
    loginService.initLoginEnter.mockImplementation(
      async (_req: Request, res: Response) => {
        res.status(204).send();
      },
    );
  });

  afterAll(async () => {
    if (originalDomain === undefined) {
      delete process.env.DOMAIN;
    } else {
      process.env.DOMAIN = originalDomain;
    }
    await app?.close();
  });

  function callback(base: string, method: 'get' | 'post', body = identity) {
    const call = supertest(app.getHttpServer())[method](`${base}/callback/42`);
    return method === 'post' ? call.type('form').send(body) : call.query(body);
  }

  it.each(['get', 'post'] as const)(
    'keeps regular %s callbacks separate from LTI session options',
    async (method) => {
      await callback(regularBase, method)
        .query({ redirect: '/courses/7?tab=queue' })
        .set('x-trust-auth-mail', 'spoofed@example.edu')
        .expect(204);

      expect(authService.shibbolethAuthCallback).toHaveBeenCalledTimes(1);
      expect(authService.shibbolethAuthCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining(trustHeaders),
        }),
        expect.anything(),
        42,
        courseService,
        undefined,
        {
          redirect: '/courses/7?tab=queue',
          cookieOptions: { httpOnly: true, secure: false },
        },
      );
    },
  );

  it('uses secure regular cookies on HTTPS without adopting LTI cookie options', async () => {
    process.env.DOMAIN = 'https://localhost';
    await callback(regularBase, 'post').expect(204);
    expect(authService.shibbolethAuthCallback.mock.calls[0][5]).toEqual({
      redirect: undefined,
      cookieOptions: { httpOnly: true, secure: true },
    });
  });

  it.each(['get', 'post'] as const)(
    'gives the dev LTI %s callback the same session contract as real Shibboleth',
    async (method) => {
      await supertest(app.getHttpServer())
        .get('/api/v1/lti/auth/shibboleth/42')
        .set(trustHeaders)
        .expect(204);
      const realCall = authService.shibbolethAuthCallback.mock.calls[0];
      expect(realCall.slice(2)).toEqual([
        42,
        undefined,
        ltiService,
        ltiOptions,
      ]);
      expect(realCall[5].expiresIn).toBe(5 * 60 * 60);
      expect(realCall[5].restrictPaths.length).toBeGreaterThan(0);

      await callback(ltiBase, method)
        .query({ redirect: '/courses/7' })
        .set('x-trust-auth-mail', 'spoofed@example.edu')
        .expect(204);
      expect(authService.shibbolethAuthCallback).toHaveBeenCalledTimes(2);
      const devCall = authService.shibbolethAuthCallback.mock.calls[1];
      expect(devCall[0].headers).toEqual(expect.objectContaining(trustHeaders));
      expect(devCall.slice(2)).toEqual(realCall.slice(2));

      // An intervening regular login must not mutate the shared LTI options.
      await callback(regularBase, 'post').expect(204);
      await callback(ltiBase, method).expect(204);
      expect(authService.shibbolethAuthCallback.mock.calls[3].slice(2)).toEqual(
        realCall.slice(2),
      );
    },
  );

  it.each([regularBase, ltiBase])(
    'serves the form and its script within %s',
    async (base) => {
      const page = await supertest(app.getHttpServer())
        .get(`${base}/login/42`)
        .expect('Content-Type', /text\/html/)
        .expect(200);
      expect(page.text).toMatch(/<form method="POST"/);
      expect(page.text).toContain(`action="${base}/callback/42"`);
      expect(page.text).toContain(`<script src="${base}/script.js"></script>`);
      if (base === ltiBase) {
        expect(page.text).not.toContain(`${regularBase}/`);
      }
      const script = await supertest(app.getHttpServer())
        .get(`${base}/script.js`)
        .expect('Content-Type', /application\/javascript/)
        .expect(200);
      expect(script.text).toContain('form.submit()');
      expect(script.text).not.toContain(`${regularBase}/callback`);
      expect(authService.shibbolethAuthCallback).not.toHaveBeenCalled();
    },
  );

  describe.each(['get', 'post'] as const)(
    '%s missing-identity retry',
    (method) => {
      it.each(['email', 'givenName', 'lastName'] as const)(
        'keeps LTI retry under the LTI prefix when %s is missing',
        async (missing) => {
          const incomplete = { ...identity };
          delete incomplete[missing];
          await callback(ltiBase, method, incomplete)
            .query({ redirect: 'https://evil.example' })
            .expect(302)
            .expect(
              'Location',
              `${ltiBase}/login/42?redirect=${encodeURIComponent('/lti?force_close=true')}`,
            );
          expect(authService.shibbolethAuthCallback).not.toHaveBeenCalled();
        },
      );
    },
  );

  it('preserves a safe regular redirect on retry', async () => {
    await callback(regularBase, 'post', { ...identity, email: '' })
      .query({ redirect: '/courses/7?tab=queue&view=all' })
      .expect(302)
      .expect(
        'Location',
        `${regularBase}/login/42?redirect=${encodeURIComponent('/courses/7?tab=queue&view=all')}`,
      );
    expect(authService.shibbolethAuthCallback).not.toHaveBeenCalled();
  });

  it.each(['https://evil.example', '//evil.example', '/\\evil.example'])(
    'discards unsafe redirect %s from forms, retries, and auth delegation',
    async (redirect) => {
      const page = await supertest(app.getHttpServer())
        .get(`${regularBase}/login/42`)
        .query({ redirect })
        .expect(200);
      expect(page.text).toContain(`action="${regularBase}/callback/42"`);
      expect(page.text).not.toContain('evil.example');
      await callback(regularBase, 'post', { ...identity, email: '' })
        .query({ redirect })
        .expect(302)
        .expect('Location', `${regularBase}/login/42`);
      await callback(regularBase, 'post').query({ redirect }).expect(204);
      expect(authService.shibbolethAuthCallback.mock.calls[0][5].redirect).toBe(
        undefined,
      );
    },
  );

  it('escapes a safe redirect in the page and encodes it in the form action', async () => {
    const redirect = '/courses/7?name="<script>alert(1)</script>"&other=\'x\'';
    const page = await supertest(app.getHttpServer())
      .get(`${regularBase}/login/42`)
      .query({ redirect })
      .expect(200);
    expect(page.text).toContain(
      '/courses/7?name=&quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot;&amp;other=&#39;x&#39;',
    );
    expect(page.text).toContain(
      `action="${regularBase}/callback/42?redirect=${encodeURIComponent(redirect).replace(/'/g, '&#39;')}"`,
    );
    expect(page.text).not.toContain('<script>alert(1)</script>');
  });

  describe('production guard', () => {
    beforeEach(() => {
      process.env.DOMAIN = PROD_URL;
    });

    describe.each([regularBase, ltiBase])('%s', (base) => {
      it.each([
        ['get', 'login/42'],
        ['get', 'script.js'],
        ['get', 'callback/42'],
        ['post', 'callback/42'],
      ] as const)('rejects %s %s', async (method, path) => {
        const call = supertest(app.getHttpServer())[method](`${base}/${path}`);
        if (method === 'post') {
          call.type('form').send(identity);
        } else {
          call.query(identity);
        }
        await call.expect(403);
        expect(authService.shibbolethAuthCallback).not.toHaveBeenCalled();
      });
    });

    it('does not block real LTI Shibboleth, SSO initiation, or login entry', async () => {
      await supertest(app.getHttpServer())
        .get('/api/v1/lti/auth/shibboleth/42')
        .set(trustHeaders)
        .expect(204);
      expect(authService.shibbolethAuthCallback.mock.calls[0].slice(2)).toEqual(
        [42, undefined, ltiService, ltiOptions],
      );
      await supertest(app.getHttpServer())
        .get('/api/v1/lti/auth/link/shibboleth/42')
        .expect(200, { redirectUri: '/real-idp' });
      expect(authService.ssoAuthInit).toHaveBeenCalledWith(
        expect.anything(),
        'shibboleth',
        42,
        'lti',
      );
      await supertest(app.getHttpServer())
        .get('/api/v1/lti/auth/entry')
        .query({ token: 'launch-token', redirect: '/lti/course/7' })
        .expect(204);
      expect(loginService.initLoginEnter).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'launch-token',
        undefined,
        ltiService,
        expect.objectContaining({ cookieName: 'lti_auth_token' }),
      );
    });
  });
});
