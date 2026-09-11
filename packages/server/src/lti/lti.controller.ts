import { LtiService } from './lti.service';
import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LtiCourse, LtiToken, LtiUser } from '../decorators/lti.decorator';
import express from 'express';
import { LtiGuard } from '../guards/lti.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import {
  AuthTokenMethodEnum,
  Database,
  IdToken,
  PlatformModel,
  PlatformProperties,
} from '@bhunt02/lti-typescript';
import {
  CreateLtiPlatform,
  ERROR_MESSAGES,
  LMSIntegrationPlatform,
  LtiPlatform,
  Role,
  UpdateLtiPlatform,
} from '@koh/common';
import { plainToClass } from 'class-transformer';
import { UserModel } from '../profile/user.entity';
import {
  IgnoreableClassSerializerInterceptor,
  IgnoreSerializer,
} from '../interceptors/IgnoreableClassSerializerInterceptor';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { LTI_APP_SESSION_SECONDS, restrictPaths } from './lti-auth.controller';
import { LoginService } from '../login/login.service';
import { EmbeddableQuestionModel } from './embeddable/question/embeddable-question.entity';

@Controller('lti')
@UseInterceptors(IgnoreableClassSerializerInterceptor)
export class LtiController {
  constructor(
    private ltiService: LtiService,
    private loginService: LoginService,
  ) {}

  @All()
  @UseGuards(LtiGuard)
  @IgnoreSerializer()
  async index(
    @Req() req: express.Request,
    @Res() res: express.Response,
    @LtiToken() token: IdToken,
    @LtiUser({ organizationUser: true }) user?: UserModel,
    @LtiCourse({ organizationCourse: { organization: true } })
    course?: CourseModel,
    @Query('lti_storage_target') lti_storage_target?: string,
  ) {
    const questionLaunch = LtiService.hasQuestionLaunch(token)
      ? await this.ltiService.validateQuestionLaunch(token)
      : undefined;

    if (questionLaunch && course?.id !== questionLaunch.courseId) {
      throw new ForbiddenException(
        'Verified Canvas course does not match the HelpMe launch course',
      );
    }

    const ltiLoginOptions = {
      cookieName: 'lti_auth_token',
      cookieOptions: LtiService.cookieOptions,
      restrictPaths,
      expiresIn: LTI_APP_SESSION_SECONDS,
    };
    const qry = new URLSearchParams();

    try {
      /*
      This is essentially a secondary 'session' cookie/token which carries
      a key to unlock information regarding the user who launched the LTI
      tool. Used to set auto-login when the HelpMe email of the user doesn't
      match their Canvas email.
      */
      const identity = await this.ltiService.createLtiIdentityToken(
        token.iss,
        token.user,
        token.userInfo.email,
      );
      res.cookie('__LTI_IDENTITY', identity, LtiService.cookieOptions);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_ignored) {}

    // If the user does not exist, but the course was found, create an invite and set it as a cookie
    if (!user && course && token.userInfo.email != undefined) {
      qry.set('redirect', `/lti/${course.id}`);

      try {
        const invite = await this.ltiService.createCourseInvite(
          course.id,
          token.userInfo.email,
        );
        res.cookie('__COURSE_INVITE', invite, LtiService.cookieOptions);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_ignored) {}
    }

    // If the user does not exist, redirect to login.
    // Exact-question return through first-time registration is intentionally
    // deferred. After registration, reopen the Canvas question for a fresh LTI launch.
    if (!user) {
      return res
        .clearCookie('lti_auth_token', LtiService.cookieOptions)
        .redirect(`/lti/login${qry.size > 0 ? `?${qry.toString()}` : ''}`);
    }

    if (course) {
      const enrollment = await UserCourseModel.findOne({
        where: {
          userId: user.id,
          courseId: course?.id,
        },
      });

      // If the user has no enrollment.
      if (!enrollment) {
        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: Role.STUDENT,
        }).save();
      }
    }

    const platformMatch =
      Object.values(LMSIntegrationPlatform).find(
        (v) => v.toLowerCase() == token.platformInfo.product_family_code,
      ) ?? LMSIntegrationPlatform.None;
    const apiCid = LtiService.extractCourseId(token);
    const hasLtiCourseContext =
      typeof apiCid === 'string' &&
      apiCid.length > 0 &&
      platformMatch !== LMSIntegrationPlatform.None;

    if (hasLtiCourseContext) {
      qry.set('api_course_id', apiCid);
      qry.set('lms_platform', platformMatch);
    }
    if (lti_storage_target) {
      qry.set('lti_storage_target', lti_storage_target);
    }

    const destination = questionLaunch
      ? `/lti/embeddable/${questionLaunch.courseId}/question/${questionLaunch.questionId}`
      : `/lti${course ? `/${course.id}` : ''}`;

    await this.loginService.enter(
      req,
      res,
      user.id,
      undefined,
      this.ltiService,
      {
        ...ltiLoginOptions,
        redirect: `${destination}${qry.size > 0 ? '?' + qry.toString() : ''}`,
      },
    );
  }

  @Get('deep-link/questions')
  @UseGuards(LtiGuard)
  @IgnoreSerializer()
  async getDeepLinkQuestions(
    @LtiToken() token: IdToken,
  ): Promise<EmbeddableQuestionModel[]> {
    return this.ltiService.getDeepLinkingQuestions(token);
  }

  @Post('deep-link/selection')
  @UseGuards(LtiGuard)
  @Header('Content-Type', 'text/html')
  @IgnoreSerializer()
  async selectDeepLinkQuestion(
    @LtiToken() token: IdToken,
    @Body() body: { questionId?: unknown },
  ): Promise<string> {
    return this.ltiService.createDeepLinkingResponse(token, body?.questionId);
  }

  @Get('/platform')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async getPlatforms(): Promise<LtiPlatform[]> {
    if (!Database.dataSource.isInitialized) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiController.ltiDataSourceUninitialized,
      );
    }
    return (await Database.find(PlatformModel)).map(mapToLocalPlatform);
  }

  @Get('/platform/:kid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async getPlatform(@Param('kid') kid: string): Promise<LtiPlatform> {
    if (!Database.dataSource.isInitialized) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiController.ltiDataSourceUninitialized,
      );
    }
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
  }

  @Post('/platform')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async createPlatform(
    @Body() params: CreateLtiPlatform,
  ): Promise<LtiPlatform> {
    const platform = await this.ltiService.provider.registerPlatform(
      params as unknown as Omit<PlatformProperties, 'kid'>,
    );
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid: platform.kid } }),
    );
  }

  @Patch('/platform/:kid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async updatePlatform(
    @Param('kid') kid: string,
    @Body() params: UpdateLtiPlatform,
  ): Promise<LtiPlatform> {
    await this.ltiService.provider.updatePlatformById(
      kid,
      params as unknown as Partial<PlatformProperties>,
    );
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
  }

  @Delete('/platform/:kid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async deletePlatform(@Param('kid') kid: string): Promise<void> {
    await this.ltiService.provider.deletePlatformById(kid);
  }

  @Patch('/platform/:kid/toggle')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async togglePlatform(@Param('kid') kid: string): Promise<LtiPlatform> {
    const platform = await this.ltiService.provider.getPlatformById(kid);
    if (platform) {
      await platform.setActive(!platform.active);
    }
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
  }

  @Get('/platform/:kid/registration')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
  async checkRegistrationStatus(
    @Param('kid') kid: string,
  ): Promise<LtiPlatform> {
    const platform = await this.ltiService.provider.getPlatformById(kid);

    return await this.ltiService.provider.DynamicRegistration.getRegistration(
      platform,
    );
  }
}

export function mapToLocalPlatform(platform: PlatformModel): LtiPlatform {
  if (!platform) return undefined;

  const authToken = platform.authToken();
  if (authToken.method !== AuthTokenMethodEnum.JWK_SET) {
    authToken.key = '********************************';
  }

  return plainToClass(LtiPlatform, {
    ...platform,
    authToken,
  });
}
