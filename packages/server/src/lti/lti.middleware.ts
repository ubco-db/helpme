import {
  HttpException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { LTIConfigModel } from './lti_config.entity';
import { isProd } from '@koh/common';
import { UserModel } from '../profile/user.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { JwtService } from '@nestjs/jwt';
import { getCookie } from '../common/helpers';
import { Database as LtiDatabase, IdToken, Provider as lti } from './lti.types';

export default class LtiMiddleware {
  static readonly prefix = 'api/v1/lti/external';
  static readonly reservedRoutes = {
    loginUrl: `${LtiMiddleware.prefix}/login`,
    keysetUrl: `${LtiMiddleware.prefix}/keys`,
    dynRegRoute: `${LtiMiddleware.prefix}/register`,
  };

  private readonly redirectRoutes: string[] = [];

  private readonly configService: ConfigService;
  private readonly jwtService: JwtService;
  private readonly dataSource: DataSource;

  constructor(private app: INestApplication) {
    this.configService = this.app.get<ConfigService>(ConfigService);
    this.jwtService = this.app.get<JwtService>(JwtService);
    this.dataSource = this.app.get<DataSource>(DataSource);
    this.redirectRoutes = [
      `${this.configService.get<string>('DOMAIN')}/lti/:cid`,
    ];
  }

  async setup() {
    if (lti && lti.app) {
      await lti.close();
    }
    lti.setup(
      this.configService.get<string>('LTI_SECRET_KEY'),
      {
        // Database
        plugin: new LtiDatabase({
          database: 'lti',
          user: this.configService.get<string>(
            `POSTGRES_${isProd() ? 'NONROOT_' : ''}USER`,
          ),
          pass: this.configService.get<string>(
            `POSTGRES_${isProd() ? 'NONROOT_' : ''}PASSWORD`,
          ),
          host: this.configService.get<string>('POSTGRES_HOST'),
        }),
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
          secure: true,
          sameSite: 'None',
        },
        https: isProd(),
        devMode: !isProd(),
      },
    );

    lti.whitelist(LtiMiddleware.reservedRoutes.keysetUrl);

    lti.onConnect(
      (
        connection: IdToken,
        request: ExpressRequest,
        response: ExpressResponse,
      ) => {
        this.onConnectHandler(connection, request, response);
      },
    );

    lti.onDynamicRegistration(
      async (token: IdToken, req: ExpressRequest, res: ExpressResponse) => {
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
          const message = await lti.DynamicRegistration.register(
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
          return res
            .status(500)
            .send({
              status: 500,
              error: 'Internal Server Error',
              details: { message: err.message },
            });
        }
      },
    );

    const deployResult = await lti.deploy({
      serverless: true,
    });
    if (!deployResult) throw new Error('Failed to initialize LTI middleware');

    const ltiConfigurations = await this.dataSource.manager
      .getRepository(LTIConfigModel)
      .find();

    for (const ltiConfig of ltiConfigurations) {
      await lti.registerPlatform({
        url: ltiConfig.url,
        name: ltiConfig.name,
        clientId: ltiConfig.clientId ?? 'NOT_IMPLEMENTED',
        authenticationEndpoint: ltiConfig.authenticationEndpoint,
        accesstokenEndpoint: ltiConfig.accesstokenEndpoint,
        authConfig: { method: 'JWK_SET', key: ltiConfig.keysetEndpoint },
      });
    }

    return lti.app;
  }

  async onConnectHandler(
    connection: IdToken,
    request: ExpressRequest,
    response: ExpressResponse,
  ) {
    console.log(request.url);
    try {
      let userId: number | undefined = undefined;
      let courseId: number | undefined = undefined;

      const authCookie = getCookie(request, 'auth_token');
      const user = authCookie
        ? (this.jwtService.decode(authCookie) as { userId: number })
        : undefined;

      const matchingUserIds =
        user?.userId != undefined
          ? [user?.userId]
          : (
              await UserModel.find({
                where: { email: connection.userInfo.email },
              })
            ).map((u) => u.id);

      if (matchingUserIds.length > 0) {
        for (const matchingUserId of matchingUserIds) {
          const userCourse = await UserCourseModel.findOne({
            where: {
              userId: matchingUserId,
              courseId:
                connection.platformInfo[
                  'https://purl.imsglobal.org/spec/lti/claim/custom'
                ].canvas_course_id,
            },
          });
          if (!userCourse) {
            continue;
          }
          courseId = userCourse.courseId;
          userId = matchingUserId;
          break;
        }
      }
      if (userId == undefined || courseId == undefined) {
        throw new NotFoundException(
          'Failed to find matching user/course pair based on request from LTI within the HelpMe system.',
        );
      }

      // This isn't going to work because of Third-Party cookies not mattering + iframe probably
      // Will have to just embed the token in a request which retrieves info from the frontend manually
      // This will be really hacky probably but we need a way to track the auth state
      //
      // if (!authCookie) {
      //   await LoginController.attachAuthToken(
      //     response,
      //     userId,
      //     this.jwtService,
      //     this.configService,
      //     60 * 60, // Expires in 1 Hour
      //   );
      // }

      if (Object.values(LtiMiddleware.reservedRoutes).includes(request.url)) {
        return response.redirect(`/api/v1/lti/${request.path}`);
      } else {
        return response.redirect(`/api/v1/lti/${courseId}/${request.path}`);
      }
    } catch (err) {
      if (err instanceof HttpException) {
        return response.status(err.getStatus()).send(err.getResponse());
      } else {
        return response.status(500).send(err);
      }
    }
  }
}
