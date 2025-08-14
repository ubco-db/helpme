import {
  HttpException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { IdToken, Provider as lti, ProviderOptions } from 'ltijs';
import { Request, Response } from 'express';
import { LTIConfigModel } from './lti_config.entity';
import { isProd } from '@koh/common';
import { UserModel } from '../profile/user.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { JwtService } from '@nestjs/jwt';
import { getCookie } from '../common/helpers';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('ltijs-postgresql');

const reservedRoutes = {
  loginUrl: 'api/v1/lti/login',
  keysetUrl: 'api/v1/lti/keys',
};

const reservedUrls = Object.keys(reservedRoutes).map((k) => reservedRoutes[k]);

export default class LtiMiddleware {
  private readonly configService: ConfigService;
  private readonly jwtService: JwtService;
  private readonly dataSource: DataSource;

  constructor(private app: INestApplication) {
    this.configService = this.app.get<ConfigService>(ConfigService);
    this.jwtService = this.app.get<JwtService>(JwtService);
    this.dataSource = this.app.get<DataSource>(DataSource);
  }

  async setup() {
    if (lti && lti.app) {
      await lti.close();
    }
    lti.setup(
      this.configService.get<string>('LTI_SECRET_KEY'),
      {
        // Database
        plugin: new Database({
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
        appUrl: '',
        ...reservedRoutes,
        cookies: {
          secure: true,
          sameSite: 'None',
        },
        https: isProd(),
        logger: true,
        devMode: !isProd(),
      } as ProviderOptions,
    );

    lti.whitelist(reservedRoutes.keysetUrl);

    lti.onConnect(
      (connection: IdToken, request: Request, response: Response) => {
        this.onConnectHandler(connection, request, response);
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
    request: Request,
    response: Response,
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

      if (reservedUrls.includes(request.url)) {
        return response.redirect(`/api/v1/lti/${request.path}`);
      } else {
        return response.redirect(`/lti/${courseId}/${request.path}`);
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
