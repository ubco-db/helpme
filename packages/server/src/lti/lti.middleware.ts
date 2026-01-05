// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { HttpException, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { isProd } from '@koh/common';
import {
  Database,
  Debug,
  DynamicRegistrationSecondaryOptions,
  IdToken,
  LtiMessageRegistration,
  PlatformModel,
  Provider,
  register,
} from 'lti-typescript';
import { JwtService } from '@nestjs/jwt';
import { LtiService } from './lti.service';

const dynRegScopes = [
  'https://purl.imsglobal.org/spec/lti-reg/scope/registration',
  'https://purl.imsglobal.org/spec/lti-reg/scope/registration.readonly',
];

export default class LtiMiddleware {
  private prefix: string;
  private reservedRoutes: {
    loginUrl?: string;
    keySetUrl?: string;
    dynRegUrl?: string;
  };
  private readonly redirectRoutes: string[] = [];

  private readonly configService: ConfigService;
  private readonly jwtService: JwtService;
  private readonly ltiService: LtiService;
  private readonly dataSource: DataSource;

  static async enable(app: INestApplication, baseUrl: string): Promise<void> {
    try {
      const ltiMiddleware = new LtiMiddleware(app, baseUrl);
      const provider = await ltiMiddleware.setup();
      app.use(baseUrl, provider.app);

      const ltiService = app.get<LtiService>(LtiService);
      ltiService.provider = provider;
    } catch (err) {
      // Don't allow LTI failure to prevent application from working, but log its error
      console.error(`FAILED TO INITIALIZE LTI AS A MIDDLEWARE`);
      console.error(err);
    }
  }

  private baseRoute(): string {
    return `${this.configService.get<string>('DOMAIN')}${this.prefix}`;
  }
  private constructor(
    private app: INestApplication,
    baseUrl: string,
  ) {
    this.configService = this.app.get<ConfigService>(ConfigService);
    this.jwtService = this.app.get<JwtService>(JwtService);
    this.ltiService = this.app.get<LtiService>(LtiService);
    this.dataSource = this.app.get<DataSource>(DataSource);

    this.prefix = (baseUrl.startsWith('/') ? '' : '/') + baseUrl;
    this.reservedRoutes = {
      loginUrl: `/login`,
      keySetUrl: `/keys`,
      dynRegUrl: `/register`,
    };

    this.redirectRoutes = [
      this.baseRoute(),
      `${this.configService.get<string>('DOMAIN')}/lti`,
    ];
  }

  private async setup(): Promise<Provider> {
    const variables: Record<string, any> = {
      secret: this.configService.get<string>('LTI_SECRET_KEY'),
      user: this.configService.get<string>(
        `POSTGRES${isProd() ? '_NONROOT' : ''}_USER`,
      ),
      password: this.configService.get<string>(
        `POSTGRES${isProd() ? '_NONROOT' : ''}_PASSWORD`,
      ),
      host: this.configService.get<string>('POSTGRES_HOST'),
      port: this.configService.get<string>('POSTGRES_PORT'),
      db: this.configService.get<string>('POSTGRES_LTI_DB'),
    };
    Object.entries(variables).forEach(([k, v]) => {
      if (!v) {
        throw new Error(`Missing ${k} environment variable.`);
      }
    });

    const secondaryOptions: DynamicRegistrationSecondaryOptions = {
      scope: [
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
        ...dynRegScopes,
      ].join(' '),
      client_name: 'HelpMe',
      'https://purl.imsglobal.org/spec/lti-tool-configuration': {
        messages: [
          {
            type: 'LtiResourceLinkRequest',
            placements: [
              // CANVAS
              'link_selection',
              'course_home_sub_navigation',
              'course_navigation',
              'module_menu',
            ],
            // CANVAS PROPERTIES
            'https://canvas.instructure.com/lti/launch_height': '100%',
            'https://canvas.instructure.com/lti/launch_width': '100%',
            // possible values: "default" | "full_width" | "full_width_in_context" | "full_width_with_nav" | "in_nav_context" | "borderless" | "new_window"
            'https://canvas.instructure.com/lti/display_type':
              'full_width_in_context',
          },
        ] as (LtiMessageRegistration & any)[],
      },
      // CANVAS PROPERTIES
      'https://canvas.instructure.com/lti/privacy_level': 'public',
    } as DynamicRegistrationSecondaryOptions & any;

    const provider = await register(
      variables.secret,
      {
        type: 'postgres',
        url: `postgres://${variables.user}:${variables.password}@${variables.host}:${variables.port}/${variables.db}`,
        synchronize: true,
        logging:
          this.configService.get<string>('NODE_ENV') !== 'production'
            ? ['error', 'warn']
            : !!process.env.TYPEORM_LOGGING,
      },
      {
        // LTI Configuration Options
        appUrl: '/',
        ...this.reservedRoutes,
        dynReg: {
          url: `${this.configService.get<string>('DOMAIN')}`,
          name: 'HelpMe',
          logo: `${this.configService.get<string>('DOMAIN')}/helpme_logo_medium.png`,
          description:
            'External UBC-affiliated application. This tool provides access to its course-specific chatbots.',
          redirectUris: this.redirectRoutes,
          customParameters: {
            canvas_course_id: '$Canvas.course.id',
          },
          autoActivate: true,
        },
        cookies: {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        },
        tokenMaxAge: 30,
        debug: !isProd(),
        cors: true,
        prefix: this.prefix,
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
            secondaryOptions,
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

    const platforms = await Database.find(PlatformModel);

    provider.whitelist = [
      {
        route: /\/platform.*/,
        method: 'ALL',
      },
      {
        route: /\/auth.*/,
        method: 'ALL',
      },
      `/static`,
    ];

    const deployResult = await provider.deploy({
      serverless: true,
    });

    if (!deployResult) {
      throw new Error('Failed to initialize LTI middleware');
    }

    for (const platformModel of platforms.filter(
      (c) => c.dynamicallyRegistered && c.registrationEndpoint,
    )) {
      try {
        const platform = await provider.getPlatformById(platformModel.kid);
        const hasReadScope =
          platform.scopesSupported.includes(dynRegScopes[0]) ||
          platform.scopesSupported.includes(dynRegScopes[1]);
        const hasWriteScope = platform.scopesSupported.includes(
          dynRegScopes[0],
        );
        if (platform && hasReadScope) {
          try {
            const registration =
              await provider.DynamicRegistration.getRegistration(platform);
            if (hasWriteScope && registration != undefined) {
              await provider.DynamicRegistration.updateRegistration(platform);
            }
          } catch (err) {
            // Delete platforms with 'not found' registrations
            if ((err as Error).message.includes('404:')) {
              await provider.deletePlatformById(platform.kid);
            }
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_err) {}
    }

    return provider;
  }

  private async onConnectHandler(
    token: IdToken,
    _: ExpressRequest,
    response: ExpressResponse,
    next: NextFunction,
  ) {
    try {
      const { userId, courseId } =
        await LtiService.findMatchingUserAndCourse(token);
      response.locals.userId = userId;
      response.locals.courseId = courseId;

      return next();
    } catch (err) {
      Debug.log(this, err);
      if (err instanceof HttpException) {
        return response.status(err.getStatus()).send(err.getResponse());
      } else {
        return response.status(500).send(err);
      }
    }
  }
}
