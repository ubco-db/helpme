import { DataSource } from 'typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { FactoryModule } from '../factory/factory.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FactoryService } from '../factory/factory.service';
import {
  initFactoriesFromService,
  UserFactory,
} from '../../test/util/factories';
import { LoginService } from './login.service';
import { ERROR_MESSAGES } from '@koh/common';
import { Locals, Request, Response } from 'express';
import { CookieOptions } from 'express-serve-static-core';
import { UserModel } from '../profile/user.entity';

class MockResponse<
  TBody = any,
  TLocals = Record<string, any>,
> extends Response {
  _headers: Record<string, string> = {};
  statusCode: number;
  _redirect: string;
  _cookies: Record<string, string> = {};
  _body: TBody;
  locals: TLocals & Locals;
  headersSent: boolean;

  set(field: any, value?: string | string[]): this {
    if (typeof field === 'string') {
      this._headers[field] = Array.isArray(value) ? value.join(';') : value;
    } else {
      this._headers = {
        ...this._headers,
        ...field,
      };
    }
    return this;
  }

  header(field: any, value?: string | string[]): this {
    return this.set(field, value);
  }

  get(field: string): string | undefined {
    return this._headers[field];
  }

  cookie(name: string, val: string | any, options?: CookieOptions): this {
    this._cookies[`${name}${options ? '-' + JSON.stringify(options) : ''}`] =
      typeof val == 'string' ? val : JSON.stringify(val);
    this._headers['cookie'] = Object.entries(this._cookies)
      .map(([k, v]) => `${k.substring(0, k.indexOf('-'))}=${v}`)
      .join('; ');
    return this;
  }

  clearCookie(name: string, options?: CookieOptions): this {
    delete this._cookies[`${name}-${JSON.stringify(options)}`];
    this._headers['cookie'] = Object.entries(this._cookies)
      .map(([k, v]) => `${k.substring(0, k.indexOf('-'))}=${v}`)
      .join('; ');
    return this;
  }

  location(url: string): this {
    this._headers['location'] = url;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  sendStatus(code: number): this {
    this.statusCode = code;
    this.send();
    return this;
  }

  redirect(url: string): void;
  redirect(code: number | string, url?: string): void {
    if (typeof code === 'string') {
      this._redirect = code;
      this.statusCode = 302;
    } else {
      this._redirect = url;
      this.statusCode = code;
    }
  }

  send(body?: any): this {
    if (!this.statusCode) {
      this.statusCode = 200;
    }
    this._body = body;
    this.headersSent = true;
    return this;
  }
}

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
      providers: [LoginService],
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
        {} as Request,
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
          {} as Request,
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
        {} as Request,
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
        {} as Request,
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
          {} as Request,
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
      },
    );
  });

  describe('handleCookies', () => {
    // TODO: Implement tests for 'handleCookies' function
    it('', async () => {});
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
