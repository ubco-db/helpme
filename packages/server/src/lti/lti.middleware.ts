import { HttpException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Express,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { LTIConfigModel } from './lti_config.entity';
import { isProd } from '@koh/common';
import { AuthTokenMethodEnum, IdToken, register } from 'lti-typescript';
import { JwtService } from '@nestjs/jwt';
import { LtiService } from './lti.service';

export default class LtiMiddleware {
  static readonly prefix = '/api/v1/lti';
  static readonly reservedRoutes = {
    loginUrl: `${LtiMiddleware.prefix}/login`,
    keysetUrl: `${LtiMiddleware.prefix}/keys`,
    dynRegRoute: `${LtiMiddleware.prefix}/register`,
  };

  private readonly redirectRoutes: string[] = [];

  private readonly configService: ConfigService;
  private readonly jwtService: JwtService;
  private readonly ltiService: LtiService;
  private readonly dataSource: DataSource;

  static async enable(app: INestApplication, baseUrl: string) {
    try {
      const ltiMiddleware = new LtiMiddleware(app);
      const ltiApp = await ltiMiddleware.setup();
      app.use(baseUrl, ltiApp);
    } catch (err) {
      // Don't allow LTI failure to prevent application from working, but log its error
      console.error(`FAILED TO INITIALIZE LTI AS A MIDDLEWARE: ${err}`);
    }
  }

  private constructor(private app: INestApplication) {
    this.configService = this.app.get<ConfigService>(ConfigService);
    this.jwtService = this.app.get<JwtService>(JwtService);
    this.ltiService = this.app.get<LtiService>(LtiService);
    this.dataSource = this.app.get<DataSource>(DataSource);
    this.redirectRoutes = [
      `${this.configService.get<string>('DOMAIN')}/lti/:cid`,
    ];
  }

  private async setup(): Promise<Express> {
    const variables: Record<string, any> = {
      secret: this.configService.get<string>('LTI_SECRET_KEY'),
      user: this.configService.get<string>(
        `POSTGRES${isProd() ? '_NONROOT' : ''}_USER`,
      ),
      pwd: this.configService.get<string>(
        `POSTGRES${isProd() ? '_NONROOT' : ''}_PASSWORD`,
      ),
      host:
        (this.configService.get<string>('POSTGRES_HOST') ?? isProd())
          ? 'coursehelp.ubc.ca'
          : 'localhost',
      port: this.configService.get<string>('POSTGRES_PORT') ?? '5432',
      db: this.configService.get<string>('LTI_DATABASE') ?? 'lti',
    };
    Object.entries(variables).forEach(([k, v]) => {
      if (!v) {
        throw new Error(`Missing ${k} environment variable.`);
      }
    });

    const provider = await register(
      this.configService.get<string>('LTI_SECRET_KEY'),
      {
        type: 'postgres',
        url: `postgres://${variables.user}:${variables.password}@${variables.host}:${variables.port}/${variables.db}`,
        synchronize:
          this.configService.get<string>('NODE_ENV') !== 'production',
        logging:
          this.configService.get<string>('NODE_ENV') !== 'production'
            ? ['error', 'warn']
            : !!process.env.TYPEORM_LOGGING,
      },
      {
        // LTI Configuration Options
        appUrl: LtiMiddleware.prefix,
        ...LtiMiddleware.reservedRoutes,
        dynReg: {
          url: `${this.configService.get<string>('DOMAIN')}`,
          name: 'HelpMe',
          logo: `${this.configService.get<string>('DOMAIN')}/favicon.ico`,
          description:
            'External UBC-affiliated application. This tool provides access to its course-specific chatbots.',
          redirectUris: this.redirectRoutes,
          customParameters: {},
          autoActivate: false,
        },
        cookies: {
          secure: isProd(),
          sameSite: 'none',
        },
        devMode: !isProd(),
        debug: false,
      },
    );

    provider.onConnect(this.onConnectHandler);

    provider.onDynamicRegistration(
      async (req: ExpressRequest, res: ExpressResponse) => {
        try {
          if (!req.query.openid_configuration) {
            return res.status(400).send({
              status: 400,
              error: 'Bad Request',
              details: {
                message: 'Missing parameter: "openid_configuration".',
              },
            });
          }
          const message = await provider.DynamicRegistration.register(
            req.query.openid_configuration as string,
            req.query.registration_token as string,
            {
              'https://purl.imsglobal.org/spec/lti-tool-configuration': {},
            },
          );
          res.setHeader('Content-type', 'text/html');
          return res.send(message);
        } catch (err) {
          if (err.message === 'PLATFORM_ALREADY_REGISTERED') {
            return res.status(403).send({
              status: 403,
              error: 'Forbidden',
              details: { message: 'Platform already registered.' },
            });
          }
          return res.status(500).send({
            status: 500,
            error: 'Internal Server Error',
            details: { message: err.message },
          });
        }
      },
    );

    const deployResult = await provider.deploy({
      serverless: true,
    });
    if (!deployResult) {
      throw new Error('Failed to initialize LTI middleware');
    }

    const ltiConfigurations = await this.dataSource.manager
      .getRepository(LTIConfigModel)
      .find();

    for (const ltiConfig of ltiConfigurations) {
      await provider.registerPlatform({
        platformUrl: ltiConfig.url,
        name: ltiConfig.name,
        clientId: ltiConfig.clientId ?? 'NOT_IMPLEMENTED',
        authenticationEndpoint: ltiConfig.authenticationEndpoint,
        accessTokenEndpoint: ltiConfig.accesstokenEndpoint,
        authToken: {
          method: AuthTokenMethodEnum.JWK_SET,
          key: ltiConfig.keysetEndpoint,
        },
      });
    }

    return provider.app;
  }

  private async onConnectHandler(
    token: IdToken,
    request: ExpressRequest,
    response: ExpressResponse,
    next: NextFunction,
  ) {
    try {
      if (!Object.values(LtiMiddleware.reservedRoutes).includes(request.url)) {
        const userCourseId = request.query.auth
          ? (this.jwtService.decode(request.query.auth as string) as {
              userCourseId: number;
            })
          : await this.ltiService.findMatchingUserCourse(token);

        request.query.ucid = String(userCourseId);
      }

      return next();
    } catch (err) {
      if (err instanceof HttpException) {
        return response.status(err.getStatus()).send(err.getResponse());
      } else {
        return response.status(500).send(err);
      }
    }
  }
}
