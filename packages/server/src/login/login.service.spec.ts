import { DataSource } from 'typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MockResponse,
  TestConfigModule,
  TestTypeOrmModule,
} from '../../test/util/testUtils';
import { FactoryModule } from '../factory/factory.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FactoryService } from '../factory/factory.service';
import {
  CourseFactory,
  initFactoriesFromService,
  LtiCourseInviteFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  QueueFactory,
  QueueInviteFactory,
  UserFactory,
} from '../../test/util/factories';
import { LoginService } from './login.service';
import { ERROR_MESSAGES } from '@koh/common';
import { Request } from 'express';
import { UserModel } from '../profile/user.entity';
import { CourseService } from '../course/course.service';
import { LtiService } from '../lti/lti.service';
import { ProfInviteService } from '../course/prof-invite/prof-invite.service';
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';
import { OrganizationModel } from '../organization/organization.entity';
import { UnauthorizedException } from '@nestjs/common';

describe('LoginService', () => {
  let service: LoginService;
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
      providers: [
        LoginService,
        {
          provide: ProfInviteService,
          useValue: {
            acceptProfInviteFromCookie: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LoginService>(LoginService);
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

  describe('initLoginEnter', () => {
    it('should throw unauthorized exception if token verification fails', async () => {
      const res = new MockResponse() as any;

      const spy = jest.spyOn(JwtService.prototype, 'verifyAsync');
      spy.mockResolvedValue(null);

      await expect(
        service.initLoginEnter({} as any, res, 'invalid_token'),
      ).rejects.toThrow(new UnauthorizedException());
      spy.mockRestore();
    });

    it('should call login entry with payload userId', async () => {
      const user = await UserFactory.create();
      const res = new MockResponse() as any;

      const token = jwtService.sign({ userId: user.id });
      const spy = jest.spyOn(service, 'enter');
      spy.mockResolvedValue(undefined);

      await service.initLoginEnter({} as any, res, token);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        user.id,
        undefined,
        undefined,
        undefined,
      );
      spy.mockRestore();
    });
  });

  describe('enter', () => {
    let user: UserModel;

    beforeEach(async () => {
      user = await UserFactory.create();
    });

    it('should return a response with status 500 if token fails to be created', async () => {
      const spy = jest.spyOn(JwtService.prototype, 'signAsync');
      spy.mockResolvedValue(null);

      let res: MockResponse = new MockResponse();
      res = (await service.enter(
        { headers: {} } as Request,
        res as any,
        user.id,
      )) as unknown as MockResponse;

      expect(res.statusCode).toEqual(500);
      expect(res._body).toEqual(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
      );

      spy.mockRestore();
    });

    it.each([undefined, 'lti_auth_token'])(
      'should return a 200 response with token immediately if specified',
      async (cookieName) => {
        const opts = {
          returnImmediate: true,
          returnImmediateMessage: 'MESSAGE',
          cookieName,
          cookieOptions: {
            secure: true,
          },
        };

        let res: MockResponse = new MockResponse();
        res = (await service.enter(
          { headers: {} } as Request,
          res as any,
          user.id,
          undefined,
          undefined,
          opts,
        )) as unknown as MockResponse;

        expect(res.statusCode).toEqual(200);
        expect(
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ],
        ).toBeDefined();
        const cookie =
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ];
        const payload = jwtService.decode(cookie);
        expect(payload.userId).toEqual(user.id);
        expect(res._body).toHaveProperty('message', 'MESSAGE');
      },
    );

    it.each([undefined, 'lti_auth_token'])(
      'should return a 200 response and perform lti cookie op with token immediately if specified',
      async (cookieName) => {
        const opts = {
          returnImmediate: true,
          returnImmediateMessage: 'MESSAGE',
          cookieName,
          cookieOptions: {
            secure: true,
          },
        };

        const fakeLti = {
          checkCourseInvite: jest.fn().mockImplementation((res) => res),
        } as any;
        let res: MockResponse = new MockResponse();
        res = (await service.enter(
          {
            headers: {
              cookie: '__COURSE_INVITE=aklfgadfjhlkajdfh',
            },
          } as Request,
          res as any,
          user.id,
          undefined,
          fakeLti,
          opts,
        )) as unknown as MockResponse;

        expect(res.statusCode).toEqual(200);
        expect(
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ],
        ).toBeDefined();
        const cookie =
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ];
        const payload = jwtService.decode(cookie);
        expect(fakeLti.checkCourseInvite).toHaveBeenCalledTimes(1);
        expect(payload.userId).toEqual(user.id);
        expect(res._body).toHaveProperty('message', 'MESSAGE');
      },
    );

    it('should return if handleCookies sent headers', async () => {
      const opts = {
        cookieOptions: {
          secure: true,
        },
      };

      const spy = jest.spyOn(service, 'handleCookies');
      spy.mockImplementation(async (_: any, res: any) => {
        return res.status(307).send({ message: 'ERROR' });
      });

      let res: MockResponse = new MockResponse();
      await service.enter(
        { headers: {} } as Request,
        res as any,
        user.id,
        undefined,
        undefined,
        opts,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(307);
      expect(Object.keys(res._cookies)).toHaveLength(0);
      expect(res._body).toHaveProperty('message', 'ERROR');

      spy.mockClear();
      res = new MockResponse();

      spy.mockImplementation(async (_: any, resp: any) => {
        resp.status(302).send({ message: 'ERROR2' });
        return {
          res: resp,
          redirectUrl: '',
        };
      });

      await service.enter(
        { headers: {} } as Request,
        res as any,
        user.id,
        undefined,
        undefined,
        opts,
      );

      expect(spy).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(302);
      expect(Object.keys(res._cookies)).toHaveLength(0);
      expect(res._body).toHaveProperty('message', 'ERROR2');

      spy.mockRestore();
    });

    it.each([undefined, 'lti_auth_token'])(
      'should set cookie and redirect',
      async (cookieName) => {
        const opts = {
          cookieName,
          cookieOptions: {
            secure: true,
          },
        };

        const spy = jest.spyOn(service, 'handleCookies');
        spy.mockImplementation(async (_: any, res: any) => ({
          res,
          redirectUrl: 'redirect',
        }));

        const res: MockResponse = new MockResponse();
        await service.enter(
          { headers: {} } as Request,
          res as any,
          user.id,
          undefined,
          undefined,
          opts,
        );

        expect(res.statusCode).toEqual(302);
        expect(
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ],
        ).toBeDefined();
        const cookie =
          res._cookies[
            `${cookieName ?? 'auth_token'}-${JSON.stringify(opts.cookieOptions)}`
          ];
        const payload = jwtService.decode(cookie);
        expect(payload.userId).toEqual(user.id);
        expect(res._redirect).toEqual('redirect');
        spy.mockRestore();
      },
    );
  });

  describe('handleCookies', () => {
    let organization: OrganizationModel;
    let user: UserModel;
    let course: CourseModel;
    let queue: QueueModel;

    beforeEach(async () => {
      user = await UserFactory.create();
      course = await CourseFactory.create();
      organization = await OrganizationFactory.create();
      await OrganizationCourseFactory.create({
        course,
        organization,
      });
      await OrganizationUserFactory.create({
        organizationUser: user,
        organization,
      });
      queue = await QueueFactory.create({ course });
      await QueueInviteFactory.create({ queue, inviteCode: 'abcdefg' });
    });

    it.each([
      [
        'should return redirectURL = /invite?cid=:courseId&code=:courseInviteCode if secure redirect cookie is set',
        true,
        false,
        false,
        false,
        false,
      ],
      [
        'should process queue invite cookie if queue invite cookie is set',
        false,
        true,
        false,
        false,
        false,
      ],
      [
        'should return redirectURL = /lti/:courseId if lti invite cookie is set',
        false,
        false,
        true,
        false,
        false,
      ],
      [
        'should return redirectURL = redirect value if it is defined in params and append its search params',
        false,
        false,
        false,
        true,
        false,
      ],
      [
        'should return redirectURL = /courses',
        false,
        false,
        false,
        false,
        false,
      ],
      [
        'should return redirectURL = /invite?cid=:courseId&code=:courseInviteCode if secure redirect cookie is set with 307 if email verification is set',
        true,
        false,
        false,
        false,
        true,
      ],
      [
        'should process queue invite cookie if queue invite cookie is set with 307 if email verification is set',
        false,
        true,
        false,
        false,
        true,
      ],
      [
        'should return redirectURL = /lti/:courseId if lti invite cookie is set with 307 if email verification is set',
        false,
        false,
        true,
        false,
        true,
      ],
      [
        'should return redirectURL = redirect value if it is defined in params and append its search params 307 if email verification is set',
        false,
        false,
        false,
        true,
        true,
      ],
      [
        'should return no redirect url with 202 if email verification is set',
        false,
        false,
        false,
        false,
        true,
      ],
    ])(
      '%s',
      async (
        _m0,
        secureRedirect: boolean,
        queueInvite: boolean,
        ltiInvite: boolean,
        explicitRedirect: boolean,
        emailVerification: boolean,
      ) => {
        const options = {
          cookieOptions: {
            secure: true,
            httpOnly: true,
          },
          redirect: explicitRedirect ? '/redirect?example=value' : undefined,
          emailVerification,
        };
        const courseService = new CourseService(
          {} as any,
          {} as any,
          dataSource,
        );
        const ltiService = new LtiService(jwtService);

        const cookies: string[] = [];
        if (ltiInvite) {
          const invite = await LtiCourseInviteFactory.create({
            email: user.email,
            course: course,
          });
          const token = jwtService.sign({
            courseId: course.id,
            inviteCode: invite.inviteCode,
          });
          cookies.push(`__COURSE_INVITE=${token}`);
        }

        if (queueInvite) {
          cookies.push(
            `queueInviteInfo=${course.id},${queue.id},${organization.id},`,
          );
        }

        if (secureRedirect) {
          cookies.push(
            `__SECURE_REDIRECT=${course.id},${course.courseInviteCode}${organization ? `,${organization.id}` : ''},`,
          );
        }

        const req = {
          headers: {
            cookie: cookies.join(';'),
          },
        };

        const response: MockResponse = new MockResponse() as any;
        for (const cookie of cookies) {
          const [key, value] = cookie.split('=');
          response.cookie(key, value, options.cookieOptions);
        }

        const result = (await service.handleCookies(
          req as any,
          response as any,
          user.id,
          options,
          courseService,
          ltiService,
        )) as any;

        if (!emailVerification) {
          expect('res' in result).toBeTruthy();
          expect('redirectUrl' in result).toBeTruthy();

          const { res, redirectUrl } = result;
          expect(res.headersSent).toEqual(false);
          if (queueInvite) {
            expect(res._cookies['queueInviteInfo']).toBeUndefined();
            expect(redirectUrl).toEqual(`/courses?err=notInCourse`);
          } else if (secureRedirect) {
            expect(res._cookies['__SECURE_REDIRECT']).toBeUndefined();
            expect(redirectUrl).toEqual(
              `/invite?cid=${course.id}&code=${course.courseInviteCode}`,
            );
          } else if (ltiInvite) {
            expect(res._cookies['__COURSE_INVITE']).toBeUndefined();
            expect(redirectUrl).toEqual(`/lti/${course.id}`);
          } else if (explicitRedirect) {
            expect(redirectUrl).toEqual(options.redirect);
          } else {
            expect(redirectUrl).toEqual('/courses');
          }
        } else {
          const res = result as MockResponse;
          expect(res.headersSent).toEqual(true);

          if (queueInvite) {
            expect(res._cookies['queueInviteInfo']).toBeUndefined();
            expect(res._body).toHaveProperty(
              'redirectUri',
              `/courses?err=notInCourse`,
            );
          } else if (secureRedirect) {
            expect(res._cookies['__SECURE_REDIRECT']).toBeUndefined();
            expect(res._body).toHaveProperty(
              'redirectUri',
              `/invite?cid=${course.id}&code=${course.courseInviteCode}`,
            );
          } else if (ltiInvite) {
            expect(res._cookies['__COURSE_INVITE']).toBeUndefined();
            expect(res._body).toHaveProperty(
              'redirectUri',
              `/lti/${course.id}`,
            );
          } else if (explicitRedirect) {
            expect(res._body).toHaveProperty('redirectUri', options.redirect);
          } else {
            expect(res._body).toHaveProperty('message', 'Email verified');
          }

          if (res._body.message != undefined) {
            expect(res.statusCode).toEqual(202);
          } else {
            expect(res.statusCode).toEqual(307);
          }
        }
      },
    );
  });

  describe('generateAuthToken', () => {
    it('should throw an error if the auth token is invalid', async () => {
      const spy = jest.spyOn(JwtService.prototype, 'signAsync');
      spy.mockResolvedValue(null);
      await expect(service.generateAuthToken(1)).rejects.toThrow(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
      );
      spy.mockRestore();
    });

    it('should sign an auth token with the provided params', async () => {
      const result = await service.generateAuthToken(1);

      expect(typeof result).toEqual('string');
      const decoded = await jwtService.decode(result);
      expect(decoded).toBeDefined();
      expect(decoded).toEqual(
        expect.objectContaining({
          userId: 1,
          iat: expect.anything(),
          expiresIn: 60 * 60 * 24 * 30,
        }),
      );
    });
  });
});
