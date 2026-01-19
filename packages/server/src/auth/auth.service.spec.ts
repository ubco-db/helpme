import { Test, TestingModule } from '@nestjs/testing';
import {
  AUTH_URL,
  AuthService,
  OPEN_ID_AUTH,
  OPEN_ID_SCOPES,
} from './auth.service';
import {
  MockResponse,
  TestConfigModule,
  TestTypeOrmModule,
} from '../../test/util/testUtils';
import { UserModel } from 'profile/user.entity';
import { DataSource } from 'typeorm';
import {
  AuthStateFactory,
  initFactoriesFromService,
  OrganizationFactory,
  OrganizationUserFactory,
  UserFactory,
} from '../../test/util/factories';
import {
  AccountRegistrationParams,
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
import { LoginModule } from '../login/login.module';
import { LoginService } from '../login/login.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrganizationModel } from '../organization/organization.entity';
import { HttpStatus, MethodNotAllowedException } from '@nestjs/common';
import { TokenAction, UserTokenModel } from '../profile/user-token.entity';
import * as crypto from 'crypto';
import * as request from 'superagent';
import { AuthStateModel } from './auth-state.entity';
import { pick } from 'lodash';

jest.mock('superagent', () => ({
  post: jest.fn(),
}));

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
  let jwtService: JwtService;
  let configService: ConfigService;
  let roleChangeSpy: jest.SpyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        MailModule,
        LoginModule,
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
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET'),
          }),
        }),
      ],
      providers: [
        AuthService,
        LoginService,
        OrganizationService,
        RedisProfileModule,
        { provide: MailService, useClass: MockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    dataSource = module.get<DataSource>(DataSource);
    configService = module.get<ConfigService>(ConfigService);

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

  let registrationParams: AccountRegistrationParams;
  let organization: OrganizationModel;

  beforeEach(async () => {
    organization = await OrganizationFactory.create({
      ssoEnabled: true,
      googleAuthEnabled: true,
    });
    registrationParams = {
      email: 'fake_email@example.com',
      firstName: 'First',
      lastName: 'Last',
      password: 'pass',
      confirmPassword: 'pass',
      organizationId: organization.id,
      recaptchaToken: '',
    };
  });

  describe('clearAuthStates', () => {
    it('should remove any existing auth states that are expired', async () => {
      const validAuthState = await AuthStateFactory.create({ organization });
      const invalidAuthState = await AuthStateFactory.create({
        organization,
        expiresInSeconds: 0,
      });

      await service.clearAuthStates();

      expect(
        await AuthStateModel.findOne({
          where: { state: validAuthState.state },
        }),
      ).toEqual(
        pick(validAuthState, [
          'organizationId',
          'state',
          'createdAt',
          'expiresInSeconds',
        ]),
      );
      expect(
        await AuthStateModel.findOne({
          where: { state: invalidAuthState.state },
        }),
      ).toBeNull();
    });
  });

  describe('registerAccount', () => {
    it('should write request status 400 bad request with message if an error occurs', async () => {
      const registerSpy = jest.spyOn(service, 'register');
      registerSpy.mockRejectedValue(new Error('some error'));

      let res: any = new MockResponse() as any;
      res = (await service.registerAccount(
        {} as any,
        res as any,
        registrationParams,
      )) as any;

      expect(res).toBeDefined();

      registerSpy.mockRestore();
      expect(res.statusCode).toEqual(400);
      expect(res._body).toHaveProperty('message', 'some error');
    });

    it.each([undefined, 1])(
      'should register an account, add student subscriptions, and call login entry',
      async (sid) => {
        const registerSpy = jest.spyOn(service, 'register');
        const subSpy = jest.spyOn(service, 'createStudentSubscriptions');
        const loginSpy = jest.spyOn(LoginService.prototype, 'enter');

        let res: any = new MockResponse() as any;
        res = (await service.registerAccount(
          { headers: {} } as any,
          res as any,
          {
            ...registrationParams,
            sid,
          },
        )) as any;

        const { userId } = jwtService.decode(
          res._cookies[
            `auth_token-${JSON.stringify({ httpOnly: true, secure: false })}`
          ],
        );

        expect(registerSpy).toHaveBeenCalledTimes(1);
        expect(registerSpy).toHaveBeenCalledWith({
          ...registrationParams,
          sid: sid ? sid : -1,
        });
        expect(subSpy).toHaveBeenCalledTimes(1);
        expect(subSpy).toHaveBeenCalledWith(userId);
        expect(loginSpy).toHaveBeenCalledTimes(1);
        expect(loginSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          userId,
          undefined,
          undefined,
          {
            returnImmediate: true,
            returnImmediateMessage: 'Account created',
          },
        );

        registerSpy.mockRestore();
        subSpy.mockRestore();
        loginSpy.mockRestore();

        expect(res).toBeDefined();
        expect(res.statusCode).toEqual(200);
        expect(res._body).toHaveProperty('message', 'Account created');
      },
    );
  });

  describe('ssoAuthInit', () => {
    it('should fail with 404 if organization not found', async () => {
      let res: any = new MockResponse() as any;
      res = (await service.ssoAuthInit(res as any, '', 0)) as any;
      expect(res.statusCode).toEqual(404);
      expect(res._body).toHaveProperty('message', 'Organization not found');
    });

    it('should fail with 400 if auth_method invalid', async () => {
      let res: any = new MockResponse() as any;
      res = (await service.ssoAuthInit(res as any, '', organization.id)) as any;
      expect(res.statusCode).toEqual(400);
      expect(res._body).toHaveProperty('message', 'Invalid auth method');
    });

    it.each(['google'])(
      '(%s) should redirect with query params',
      async (auth_method: string) => {
        const baseUrl = AUTH_URL[auth_method];

        let res: any = new MockResponse() as any;
        res = (await service.ssoAuthInit(
          res as any,
          auth_method,
          organization.id,
        )) as any;

        expect(res.statusCode).toEqual(200);
        expect(res._body).toHaveProperty('redirectUri');

        const redirectUri = new URL(res._body.redirectUri);
        expect(
          redirectUri.protocol + '//' + redirectUri.host + redirectUri.pathname,
        ).toEqual(baseUrl);

        expect(redirectUri.searchParams.get('redirect_uri')).toEqual(
          `${configService.get('DOMAIN')}/api/v1/auth/callback/${auth_method}`,
        );

        if (auth_method == 'google') {
          expect(redirectUri.searchParams.has('client_id')).toEqual(true);
          expect(redirectUri.searchParams.get('response_type')).toEqual('code');
        }

        if (OPEN_ID_AUTH.includes(auth_method)) {
          expect(redirectUri.searchParams.get('scope')).toEqual(
            OPEN_ID_SCOPES.join(' '),
          );
        }
      },
    );
  });

  describe('shibbolethAuthCallback', () => {
    it('should redirect to /failed/40000 if organization id invalid', async () => {
      const res: any = new MockResponse() as any;
      await service.shibbolethAuthCallback({} as any, res as any, 0);

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40000');
    });

    it('should redirect to /failed/40002 if organization sso disabled', async () => {
      const org = await OrganizationFactory.create({
        ssoEnabled: false,
      });
      const res: any = new MockResponse() as any;
      await service.shibbolethAuthCallback({} as any, res as any, org.id);

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40002');
    });

    it('should redirect to login with error if mail, givenName, or lastName is invalid', async () => {
      const res: any = new MockResponse() as any;
      await service.shibbolethAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        organization.id,
      );

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual(
        `/login?error=errorCode400${encodeURIComponent('The login service you logged in with did not provide the required email, first name, and last name headers')}`,
      );
    });

    const validHeaders = {
      'x-trust-auth-mail': 'example@email.com',
      'x-trust-auth-givenname': 'first',
      'x-trust-auth-lastname': 'last',
    };

    it('should redirect to login if error occurs in shib login or enter', async () => {
      const spy = jest.spyOn(service, 'loginWithShibboleth');
      spy.mockRejectedValueOnce(
        new MethodNotAllowedException('method not allowed'),
      );

      let res: any = new MockResponse() as any;
      await service.shibbolethAuthCallback(
        {
          headers: validHeaders,
        } as any,
        res as any,
        organization.id,
      );
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual(
        `/login?error=errorCode${HttpStatus.METHOD_NOT_ALLOWED}${encodeURIComponent('method not allowed')}`,
      );

      spy.mockRejectedValueOnce(new Error('generic error'));
      res = new MockResponse() as any;
      await service.shibbolethAuthCallback(
        {
          headers: validHeaders,
        } as any,
        res as any,
        organization.id,
      );
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual(
        `/login?error=errorCode500${encodeURIComponent('generic error')}`,
      );

      spy.mockRestore();
    });

    it('should call shibbolethLogin and login enter', async () => {
      const shibSpy = jest.spyOn(service, 'loginWithShibboleth');
      shibSpy.mockClear();
      const loginSpy = jest.spyOn(LoginService.prototype, 'enter');
      loginSpy.mockClear();

      const res: any = new MockResponse() as any;
      await service.shibbolethAuthCallback(
        {
          headers: validHeaders,
          cookie: '',
        } as any,
        res as any,
        organization.id,
      );

      const { userId } = jwtService.decode(
        res._cookies[
          `auth_token-${JSON.stringify({ secure: false, httpOnly: true })}`
        ],
      );

      expect(shibSpy).toHaveBeenCalledTimes(1);
      expect(shibSpy).toHaveBeenCalledWith(
        validHeaders['x-trust-auth-mail'],
        validHeaders['x-trust-auth-givenname'],
        validHeaders['x-trust-auth-lastname'],
        organization.id,
      );
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        userId,
        undefined,
        undefined,
        {
          cookieOptions: {
            httpOnly: true,
            secure: false,
          },
        },
      );

      shibSpy.mockRestore();
      loginSpy.mockRestore();

      expect(res).toBeDefined();
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/courses');
    });
  });

  describe('ssoAuthCallback', () => {
    it('should redirect to /failed/40003 if auth state is invalid', async () => {
      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback({} as any, res as any, '', '', '');

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40003');
    });

    it('should redirect to /failed/40000 if auth state has no match', async () => {
      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback({} as any, res as any, '', '', 'abc');

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40000');
    });

    it('should redirect to /failed/40002 if organization googleAuthEnabled disabled', async () => {
      const org = await OrganizationFactory.create({
        googleAuthEnabled: false,
      });
      const authState = await AuthStateFactory.create({
        organization: org,
      });
      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        '',
        '',
        authState.state,
      );

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40002');
    });

    it('should redirect to /failed/40004 if auth state is expired', async () => {
      const org = await OrganizationFactory.create({
        googleAuthEnabled: true,
      });
      const authState = await AuthStateFactory.create({
        organization: org,
        expiresInSeconds: 0,
      });
      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        '',
        '',
        authState.state,
      );

      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/failed/40004');
    });

    it('should return with 400 bad request and invalid auth method if auth method not found', async () => {
      const authState = await AuthStateFactory.create({
        organization,
      });
      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        '',
        '',
        authState.state,
      );

      expect(res.statusCode).toEqual(400);
      expect(res._body).toHaveProperty('message', 'Invalid auth method');
    });

    it('should redirect to login if error occurs in sso login or enter', async () => {
      let authState = await AuthStateFactory.create({
        organization,
      });
      const spy = jest.spyOn(service, 'loginWithGoogle');
      spy.mockRejectedValueOnce(
        new MethodNotAllowedException('method not allowed'),
      );

      let res: any = new MockResponse() as any;
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        'google',
        '',
        authState.state,
      );
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual(
        `/login?error=errorCode${HttpStatus.METHOD_NOT_ALLOWED}${encodeURIComponent('method not allowed')}`,
      );

      spy.mockRejectedValueOnce(new Error('generic error'));
      res = new MockResponse() as any;
      authState = await AuthStateFactory.create({
        organization,
      });
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        'google',
        '',
        authState.state,
      );
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual(
        `/login?error=errorCode500${encodeURIComponent('generic error')}`,
      );

      spy.mockRestore();
    });

    it('should call ssoLogin and login enter', async () => {
      const authState = await AuthStateFactory.create({
        organization,
      });
      const ssoSpy = jest.spyOn(service, 'loginWithGoogle');
      ssoSpy.mockClear();
      const loginSpy = jest.spyOn(LoginService.prototype, 'enter');
      loginSpy.mockClear();

      const res: any = new MockResponse() as any;
      await service.ssoAuthCallback(
        {
          headers: {},
        } as any,
        res as any,
        'google',
        'valid_code',
        authState.state,
      );

      const { userId } = jwtService.decode(
        res._cookies[
          `auth_token-${JSON.stringify({ secure: false, httpOnly: true })}`
        ],
      );

      expect(ssoSpy).toHaveBeenCalledTimes(1);
      expect(ssoSpy).toHaveBeenCalledWith(
        'valid_code',
        organization.id,
        'default',
      );
      expect(loginSpy).toHaveBeenCalledTimes(1);
      expect(loginSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        userId,
        undefined,
        undefined,
        {
          cookieOptions: {
            httpOnly: true,
            secure: false,
          },
        },
      );

      ssoSpy.mockRestore();
      loginSpy.mockRestore();

      expect(res).toBeDefined();
      expect(res.statusCode).toEqual(302);
      expect(res._redirect).toEqual('/courses');
    });
  });

  describe('verifyRegistrationToken', () => {
    let user: UserModel;
    let token: UserTokenModel;

    beforeEach(async () => {
      user = await UserFactory.create({
        emailVerified: false,
      });
      token = await UserTokenModel.save({
        user: user,
        token: crypto.randomBytes(32).toString('hex'),
      });
    });

    it('should return 400 if verification code not found', async () => {
      const res = new MockResponse() as any;
      const result = await service.verifyRegistrationToken(res, user.id, {
        token: 'abcdefg',
      });
      expect(result instanceof Response).toBeTruthy();
      expect(res.statusCode).toEqual(400);
      expect(res._body).toHaveProperty(
        'message',
        'Verification code was not found or it is not valid',
      );
    });

    it('should return 400 if verification code has expired', async () => {
      const token = await UserTokenModel.save({
        user: user,
        token: crypto.randomBytes(32).toString('hex'),
        expiresInSeconds: 0,
      });
      const res = new MockResponse() as any;
      const result = await service.verifyRegistrationToken(res, user.id, {
        token: token.token,
      });
      expect(result instanceof Response).toBeTruthy();
      expect(res.statusCode).toEqual(400);
      expect(res._body).toHaveProperty(
        'message',
        'Verification code has expired',
      );
    });

    it('should verify user account and set token to action complete', async () => {
      const res = new MockResponse() as any;
      const result = await service.verifyRegistrationToken(res, user.id, {
        token: token.token,
      });
      expect(typeof result).toEqual('number');
      expect(result).toEqual(user.id);

      const updatedToken = await UserTokenModel.findOne({
        where: { id: token.id },
      });
      expect(updatedToken.token_action).toEqual(TokenAction.ACTION_COMPLETE);
      const updatedUser = await UserModel.findOne({ where: { id: user.id } });
      expect(updatedUser.emailVerified).toEqual(true);
    });
  });

  describe('validateRegistrationParams', () => {
    it.each([
      [400, 'Invalid recaptcha token', { recaptchaToken: undefined }],
      [400, 'Recaptcha token invalid', { recaptchaToken: 'fail' }],
      [
        400,
        'First and last name must be at least 1 character',
        { recaptchaToken: 'succeed', firstName: '' },
      ],
      [
        400,
        'First and last name must be at least 1 character',
        { recaptchaToken: 'succeed', firstName: 'first', lastName: '' },
      ],
      [
        400,
        'First and last name must be at most 32 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first'.repeat(7),
          lastName: 'last',
        },
      ],
      [
        400,
        'First and last name must be at most 32 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last'.repeat(9),
        },
      ],
      [
        400,
        'Email must be between 4 and 64 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: '',
        },
      ],
      [
        400,
        'Email must be between 4 and 64 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'abcdefghi'.repeat(8),
        },
      ],
      [
        400,
        'Password must be between 6 and 32 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: '',
        },
      ],
      [
        400,
        'Password must be between 6 and 32 characters',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: 'abcdef'.repeat(6),
        },
      ],
      [
        400,
        'Passwords do not match',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: 'abcdef',
          confirmPassword: '',
        },
      ],
      [
        400,
        'Organization not found',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: 'abcdef',
          confirmPassword: 'abcdef',
          organizationId: 0,
        },
      ],
      [
        400,
        'Email already exists',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'inuse@example.com',
          password: 'abcdef',
          confirmPassword: 'abcdef',
          organizationId: 1,
        },
      ],
      [
        400,
        'Student ID already exists',
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: 'abcdef',
          confirmPassword: 'abcdef',
          organizationId: 1,
          sid: 1,
        },
      ],
      [
        null,
        null,
        {
          recaptchaToken: 'succeed',
          firstName: 'first',
          lastName: 'last',
          email: 'email@example.com',
          password: 'abcdef',
          confirmPassword: 'abcdef',
          organizationId: 1,
          sid: 2,
        },
      ],
    ])(
      'should return %d with %s if params %o',
      async (
        code: number | null,
        message: string | null,
        body: AccountRegistrationParams,
      ) => {
        (request.post as jest.Mock).mockResolvedValue({
          body: {
            success:
              body.recaptchaToken != undefined && body.recaptchaToken != 'fail',
          },
        });

        const u = await UserFactory.create({
          email: 'inuse@example.com',
          sid: 1,
        });

        await OrganizationUserFactory.create({
          organizationUser: u,
          organization,
        });

        const res = new MockResponse() as any;
        await service.validateRegistrationParams(res, {
          ...body,
          organizationId: body.organizationId
            ? organization.id
            : body.organizationId,
        });

        if (code == null || message == null) {
          expect(res.headersSent).toEqual(false);
        } else {
          expect(res.headersSent).toEqual(true);
          expect(res.statusCode).toEqual(code);
          expect(res._body).toHaveProperty('message', message);
        }
      },
    );
  });

  describe('issuePasswordReset', () => {
    it('should generate reset link, call mailer service to send email, and return accepted', async () => {
      const email = 'email@example.com';
      const organization = await OrganizationFactory.create();

      const user = await UserFactory.create({
        accountType: AccountType.LEGACY,
        email,
      });
      await OrganizationUserFactory.create({
        organization,
        organizationUser: user,
      });

      const spy = jest.spyOn(
        MockMailService.prototype,
        'sendPasswordResetEmail',
      );

      const res = new MockResponse() as any;
      await service.issuePasswordReset(res, email, organization.id);

      expect(res.statusCode).toBe(202);
      expect(res._body).toHaveProperty('message', 'Password reset email sent');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('validateResetPasswordParams', () => {
    it.each([
      [400, 'Invalid recaptcha token', { recaptchaToken: undefined }],
      [400, 'Recaptcha token invalid', { recaptchaToken: 'fail' }],
      [400, 'User not found', { recaptchaToken: 'succeed', userFound: false }],
      [
        400,
        'Email not verified',
        { recaptchaToken: 'succeed', userFound: true, emailVerified: false },
      ],
      [
        null,
        null,
        { recaptchaToken: 'succeed', userFound: true, emailVerified: true },
      ],
    ])(
      'should return %s with message %s given params %o',
      async (
        code,
        message,
        {
          recaptchaToken,
          userFound,
          emailVerified,
        }: {
          recaptchaToken?: string;
          userFound?: boolean;
          emailVerified?: boolean;
        },
      ) => {
        (request.post as jest.Mock).mockResolvedValue({
          body: {
            success: recaptchaToken != undefined && recaptchaToken != 'fail',
          },
        });

        const res = new MockResponse() as any;
        const user = await UserFactory.create({
          email: 'email@example.com',
          emailVerified,
        });
        await OrganizationUserFactory.create({
          organizationUser: user,
          organization,
        });
        await service.validateResetPasswordParams(res, {
          recaptchaToken,
          email: userFound ? user.email : '',
          organizationId: organization.id,
        });
        if (code == null || message == null) {
          expect(res.headersSent).toEqual(false);
        } else {
          expect(res.headersSent).toEqual(true);
          expect(res.statusCode).toEqual(code);
          expect(res._body).toHaveProperty('message', message);
        }
      },
    );
  });

  describe('loginWithShibboleth', () => {
    afterEach(() => {
      roleChangeSpy?.mockClear();
    });

    it('should return user id when user already exists', async () => {
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

    it('should return user id when user already exists', async () => {
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
      expect(user).toMatchSnapshot({
        createdAt: expect.any(String),
      });
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

    it('should return false when student id exists but in different organization', async () => {
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
    const params = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'existingEmail@mail.com',
      password: 'password',
      sid: -1,
      organizationId: 1,
    };

    afterEach(() => {
      roleChangeSpy?.mockClear();
    });

    it('should throw an error when email already exists', async () => {
      await UserModel.create({
        email: 'existingEmail@mail.com',
      }).save();

      await expect(service.register(params)).rejects.toThrow(
        'Email already exists',
      );
      expect(roleChangeSpy).not.toHaveBeenCalled();
    });

    it('should create a new user when email does not exist with empty sid', async () => {
      const organization = await OrganizationFactory.create();

      const userId = await service.register({
        ...params,
        email: 'email@mail.com',
        organizationId: organization.id,
      });

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

      const userId = await service.register({
        ...params,
        email: 'email@mail.com',
        sid: 123456,
        organizationId: organization.id,
      });

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
  });
});
