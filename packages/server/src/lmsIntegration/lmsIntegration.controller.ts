import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  SerializeOptions,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import {
  ERROR_MESSAGES,
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSAuthResponseQuery,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSFile,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  LMSPostAuthBody,
  LMSPostResponseBody,
  LMSQuiz,
  LMSQuizAccessLevel,
  LMSResourceType,
  LMSSyncDocumentsResult,
  LMSToken,
  OrganizationRole,
  RemoveLMSOrganizationParams,
  Role,
  TestLMSIntegrationParams,
  UpsertLMSCourseParams,
  UpsertLMSOrganizationParams,
} from '@koh/common';
import {
  LMSGet,
  LMSIntegrationService,
  LMSUpload,
} from './lmsIntegration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationCourseModel } from '../organization/organization-course.entity';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { User, UserId } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from '../guards/organization.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { AbstractLMSAdapter } from './lmsIntegration.adapter';
import express from 'express';
import { LMSAuthStateModel } from './lms-auth-state.entity';
import { ConfigService } from '@nestjs/config';
import { LMSAccessTokenModel } from './lms-access-token.entity';
import { OrganizationService } from '../organization/organization.service';
import { FindOptionsWhere, In, Not } from 'typeorm';
import { LMSQuizModel } from './lmsQuiz.entity';

@Controller('lms')
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ excludeExtraneousValues: true })
export class LMSIntegrationController {
  constructor(
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private integrationService: LMSIntegrationService,
  ) {}

  @Post('org/:oid/upsert')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async upsertOrganizationLMSIntegration(
    @Param('oid', ParseIntPipe) oid: number,
    @Body() props: UpsertLMSOrganizationParams,
  ): Promise<string> {
    if (!Object.keys(LMSIntegrationPlatform).includes(props.apiPlatform))
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsIntegrationInvalidPlatform,
        HttpStatus.BAD_REQUEST,
      );

    return await this.integrationService.upsertOrganizationLMSIntegration(
      oid,
      props,
    );
  }

  @Delete('org/:oid/remove')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async removeOrganizationLMSIntegration(
    @User() _user: UserModel,
    @Param('oid', ParseIntPipe) oid: number,
    @Body() body: RemoveLMSOrganizationParams,
  ): Promise<string> {
    const exists = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: oid, apiPlatform: body.apiPlatform },
    });

    if (!exists)
      throw new HttpException(
        ERROR_MESSAGES.lmsController.orgLmsIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );

    const courses = await LMSCourseIntegrationModel.find({
      where: { orgIntegration: exists },
    });

    for (const id of courses.map((c) => c.courseId)) {
      await this.integrationService.clearDocuments(id);
    }

    const platform = exists.apiPlatform;
    await LMSOrganizationIntegrationModel.remove(exists);
    return `Successfully deleted LMS integration for ${platform}`;
  }

  @Get('org/:oid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationLMSIntegrations(
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<LMSOrganizationIntegrationPartial[]> {
    const lmsIntegrations = await LMSOrganizationIntegrationModel.find({
      where: { organizationId: oid },
      relations: ['courseIntegrations', 'courseIntegrations.course'],
    });

    if (lmsIntegrations.length <= 0) {
      return [];
    }

    return lmsIntegrations.map((int) =>
      this.integrationService.getPartialOrgLmsIntegration(int),
    );
  }

  @Get('org/:oid/token')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationUserTokens(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Query(
      'platform',
      new ParseEnumPipe(LMSIntegrationPlatform, { optional: true }),
    )
    platform?: LMSIntegrationPlatform,
  ): Promise<LMSToken[]> {
    const where: FindOptionsWhere<LMSAccessTokenModel> =
      platform != undefined
        ? {
            organizationIntegration: {
              organizationId,
              apiPlatform: platform,
            },
          }
        : {
            organizationIntegration: {
              organizationId,
            },
          };
    return (
      await LMSAccessTokenModel.find({
        where,
        relations: { user: true, organizationIntegration: true },
      })
    ).map((token) => ({
      id: token.id,
      platform: token.organizationIntegration.apiPlatform,
      userId: token.userId,
      userName: token.user.name,
      userEmail: token.user.email,
    }));
  }

  @Delete('org/:oid/token/:tokenId')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async invalidateUserToken(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<boolean> {
    const token = await LMSAccessTokenModel.findOne({
      where: {
        id: tokenId,
        organizationIntegration: {
          organizationId,
        },
      },
    });
    if (!token) {
      throw new NotFoundException(
        ERROR_MESSAGES.lmsController.accessTokenNotFound,
      );
    }
    return await this.integrationService.destroyAccessToken(token);
  }

  @Get('oauth2/token')
  @UseGuards(JwtAuthGuard)
  async getAuthOptions(
    @User({
      lmsAccessTokens: { organizationIntegration: true },
      organizationUser: true,
    })
    user: UserModel,
    @Query(
      'platform',
      new ParseEnumPipe(LMSIntegrationPlatform, { optional: true }),
    )
    platform?: LMSIntegrationPlatform,
  ): Promise<LMSToken[]> {
    return user.lmsAccessTokens
      .filter((v) =>
        platform != undefined
          ? v.organizationIntegration.apiPlatform == platform
          : true,
      )
      .map((v) => ({
        id: v.id,
        platform: v.organizationIntegration.apiPlatform,
      }));
  }

  @Delete('oauth2/token/:tokenId')
  @UseGuards(JwtAuthGuard)
  async invalidateToken(
    @User({
      lmsAccessTokens: { organizationIntegration: true },
      organizationUser: true,
    })
    user: UserModel,
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<boolean> {
    const token = user.lmsAccessTokens.find((v) => v.id == tokenId);
    if (!token) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.lmsController.unauthorizedForToken,
      );
    }
    return await this.integrationService.destroyAccessToken(token);
  }

  @Get('oauth2/authorize')
  @UseGuards(JwtAuthGuard)
  async authorize(
    @User({
      organizationUser: true,
      lmsAccessTokens: { organizationIntegration: true },
    })
    user: UserModel,
    @Res() response: express.Response,
    @Query('courseId') courseId?: number,
    @Query(
      'platform',
      new ParseEnumPipe(LMSIntegrationPlatform, { optional: true }),
    )
    platform?: LMSIntegrationPlatform,
    @Query('fromLti', new ParseBoolPipe({ optional: true })) fromLti?: boolean,
  ): Promise<void> {
    if (!platform) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.missingPlatformQuery,
      );
    }

    const qry = new URLSearchParams();

    const route = fromLti
      ? `/lti`
      : courseId
        ? `/course/${courseId}/settings/lms_integrations`
        : `/courses`;

    if (fromLti) {
      qry.set('force_close', String(true));
    }

    const hasToken = user.lmsAccessTokens.find(
      (v) => v.organizationIntegration.apiPlatform == platform,
    );
    if (hasToken) {
      qry.set(
        'success_message',
        `Access token for use with ${platform} has already been created.`,
      );

      return response.status(302).redirect(route + '?' + qry.toString());
    }

    let organizationIntegration: LMSOrganizationIntegrationModel;
    try {
      organizationIntegration = await LMSOrganizationIntegrationModel.findOne({
        where: {
          organizationId: user.organizationUser.organizationId,
          apiPlatform: platform,
        },
      });

      if (!organizationIntegration) {
        throw new NotFoundException(
          ERROR_MESSAGES.lmsController.orgLmsIntegrationNotFound,
        );
      }

      if (organizationIntegration.clientId == undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingClientId,
        );
      }

      if (organizationIntegration.clientSecret == undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingClientSecret,
        );
      }

      const roles = [OrganizationRole.ADMIN, OrganizationRole.PROFESSOR];
      if (!roles.includes(user.organizationUser?.role)) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.roleGuard.mustBeRoleToAccess(roles),
        );
      }

      return await AbstractLMSAdapter.redirectAuth(
        response,
        organizationIntegration,
        user.id,
        this.configService,
        route + '?' + qry.toString(),
      );
    } catch (err) {
      if (organizationIntegration) {
        await LMSAuthStateModel.delete({
          organizationIntegration,
          user,
        });
      }
      const status = err instanceof HttpException ? err.getStatus() : 500;
      qry.set('error_message', (err as HttpException).message);
      qry.set('platform', organizationIntegration?.apiPlatform);
      response.status(status).redirect(route + '?' + qry.toString());
    }
  }

  @Get('oauth2/response')
  @UseGuards(JwtAuthGuard)
  async authorizeResponse(
    @Query() authQuery: LMSAuthResponseQuery,
    @Res() res: express.Response,
  ): Promise<void> {
    let stateModel: LMSAuthStateModel;
    try {
      const { error, error_description, code, state } = authQuery;

      stateModel = await LMSAuthStateModel.findOne({
        where: { state },
        relations: {
          user: true,
          organizationIntegration: true,
        },
      });

      if (error || error_description) {
        throw new BadRequestException(`${error}: ${error_description}`);
      }

      if (!stateModel) {
        throw new NotFoundException(ERROR_MESSAGES.lmsController.stateNotFound);
      }

      if (!code) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingCodeQueryParameter,
        );
      }

      const expired =
        (Date.now() - stateModel.createdAt.getTime()) / 1000 >
        stateModel.expiresInSeconds;
      if (expired) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.stateExpired,
        );
      }

      if (stateModel.organizationIntegration.clientId == undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingClientId,
        );
      }

      if (stateModel.organizationIntegration.clientSecret == undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingClientSecret,
        );
      }

      const authBody: LMSPostAuthBody = {
        grant_type: 'authorization_code',
        client_id: stateModel.organizationIntegration.clientId,
        client_secret: stateModel.organizationIntegration.clientSecret,
        redirect_uri: `${this.configService.get<string>('DOMAIN')}/api/v1/lms/oauth2/response`,
        code,
      };

      const response = await AbstractLMSAdapter.postAuth(
        authBody,
        stateModel.organizationIntegration,
      );
      if (response.ok) {
        if (stateModel) {
          await LMSAuthStateModel.remove(stateModel);
        }

        const raw = (await response.json()) as LMSPostResponseBody;

        await this.integrationService.createAccessToken(
          stateModel.user,
          stateModel.organizationIntegration,
          raw,
        );

        const params = new URLSearchParams(stateModel.redirectUrl);
        params.set('platform', stateModel.organizationIntegration.apiPlatform);
        params.set(
          'success_message',
          `Generated access token for use with ${stateModel.organizationIntegration.apiPlatform}!`,
        );

        return res
          .status(200)
          .redirect(
            (stateModel.redirectUrl ?? '/courses') + '?' + params.toString(),
          );
      } else {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.failedToGetAccessToken,
        );
      }
    } catch (err) {
      let qry: URLSearchParams;
      if (stateModel) {
        qry = new URLSearchParams(stateModel.redirectUrl);
        await LMSAuthStateModel.remove(stateModel);
      } else {
        qry = new URLSearchParams();
      }
      qry.set('platform', stateModel?.organizationIntegration.apiPlatform);
      qry.set('error_message', (err as Error).message);
      const status = err instanceof HttpException ? err.getStatus() : 500;
      return res
        .status(status)
        .redirect(
          (stateModel?.redirectUrl ?? '/courses') + '?' + qry.toString(),
        );
    }
  }

  @Get('course/list/:tokenId')
  @UseGuards(JwtAuthGuard)
  async getUserCourses(
    @User({
      lmsAccessTokens: { organizationIntegration: true },
      organizationUser: true,
    })
    user: UserModel,
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ): Promise<LMSCourseAPIResponse[]> {
    const accessToken = user.lmsAccessTokens.find((v) => v.id == tokenId);
    if (!accessToken) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.lmsController.unauthorizedForToken,
      );
    }

    return await this.integrationService.getAPICourses(accessToken);
  }

  @Get('course/:courseId/integrations')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getCourseOrganizationLMSIntegrations(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<LMSOrganizationIntegrationPartial[]> {
    const orgCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId: courseId,
      },
    });
    if (!orgCourse)
      throw new HttpException(
        ERROR_MESSAGES.lmsController.organizationCourseNotFound,
        HttpStatus.NOT_FOUND,
      );

    const lmsIntegrations = await LMSOrganizationIntegrationModel.find({
      where: { organizationId: orgCourse.organizationId },
    });

    if (lmsIntegrations.length <= 0) {
      return [];
    }

    return lmsIntegrations.map((int) =>
      this.integrationService.getPartialOrgLmsIntegration(int),
    );
  }

  @Post('course/:courseId/upsert')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async upsertCourseLMSIntegration(
    @UserId() userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: UpsertLMSCourseParams,
  ): Promise<any> {
    const orgCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId: courseId,
      },
    });
    if (!orgCourse) {
      throw new NotFoundException(
        ERROR_MESSAGES.lmsController.organizationCourseNotFound,
      );
    }

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      where: {
        organizationId: orgCourse.organizationId,
        apiPlatform: props.apiPlatform,
      },
    });
    if (!orgIntegration) {
      throw new NotFoundException(
        ERROR_MESSAGES.lmsController.orgLmsIntegrationNotFound,
      );
    }

    const orgSettings = await this.organizationService.getOrganizationSettings(
      orgCourse.organizationId,
    );

    const courseIntegration = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
      relations: {
        orgIntegration: true,
        accessToken: {
          organizationIntegration: true,
        },
      },
    });

    if (props.apiCourseId != undefined) {
      const apiCourseIdTaken = await LMSCourseIntegrationModel.findOne({
        where: {
          courseId: Not(courseId),
          apiCourseId: props.apiCourseId,
        },
      });
      if (apiCourseIdTaken) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.apiCourseIdInUse,
        );
      }
    }

    const accessToken =
      props.accessTokenId != undefined
        ? await LMSAccessTokenModel.findOne({
            where: {
              id: props.accessTokenId,
            },
            relations: {
              organizationIntegration: true,
            },
          })
        : undefined;

    if (
      !courseIntegration ||
      props.apiKey != undefined ||
      props.accessTokenId != undefined
    ) {
      // Prioritize usage of access token over API key if both are defined
      let useApiKey = false;
      if (orgSettings.allowLMSApiKey && props.apiKey != undefined) {
        useApiKey = true;
      } else if (!orgSettings.allowLMSApiKey && props.apiKey != undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.apiKeyDisabled,
        );
      }

      if (!courseIntegration) {
        if (!useApiKey) {
          delete props.apiKey;
          delete props.apiKeyExpiry;
          props.apiKeyExpiryDeleted = true;
        } else {
          delete props.accessTokenId;
        }
      } else {
        if (!useApiKey) {
          props.apiKey = null;
          props.apiKeyExpiry = null;
          props.apiKeyExpiryDeleted = true;
        } else {
          props.accessTokenId = null;
        }
      }

      if ((!useApiKey && !accessToken) || (useApiKey && !props.apiKey)) {
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.missingApiKeyOrToken,
        );
      }

      if (!useApiKey && accessToken.userId != userId) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.lmsController.unauthorizedForToken,
        );
      }
    }

    if (
      accessToken &&
      accessToken.organizationIntegration.apiPlatform !=
        orgIntegration.apiPlatform
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.accessTokenMismatch,
      );
    }

    if (courseIntegration != undefined) {
      return await this.integrationService.updateCourseLMSIntegration(
        courseIntegration,
        orgIntegration,
        props,
      );
    } else {
      return await this.integrationService.createCourseLMSIntegration(
        orgIntegration,
        courseId,
        props,
      );
    }
  }

  @Delete('course/:courseId/remove')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async removeCourseLMSIntegration(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<any> {
    const exists = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
    });
    if (!exists) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.courseLmsIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.integrationService.clearDocuments(courseId);

    await LMSCourseIntegrationModel.remove(exists);
    return `Successfully disconnected LMS integration`;
  }

  @Get('course/:courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getCourseLMSIntegration(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<LMSCourseIntegrationPartial | undefined> {
    const lmsIntegration = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
      relations: ['orgIntegration', 'course'],
    });
    if (lmsIntegration == undefined) return undefined;

    return this.integrationService.getPartialCourseLmsIntegration(
      lmsIntegration,
    );
  }

  @Get(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Course);
  }

  @Get(':courseId/students')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getStudents(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Students);
  }

  @Get(':courseId/assignments')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getAssignments(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Assignments);
  }

  @Get(':courseId/announcements')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getAnnouncements(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(
      courseId,
      LMSGet.Announcements,
    );
  }

  @Get(':courseId/pages')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getPages(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Pages);
  }

  @Get(':courseId/files')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getFiles(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Files);
  }

  @Get(':courseId/quiz/:quizId/preview/:accessLevel')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getQuizContentPreview(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
    @Param('accessLevel') accessLevel: LMSQuizAccessLevel,
  ): Promise<{ content: string }> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: { courseId },
      relations: { orgIntegration: true },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if quiz resource is enabled
    const selectedResources: LMSResourceType[] =
      integration.selectedResourceTypes;
    if (!selectedResources.includes(LMSResourceType.QUIZZES)) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.resourceDisabled,
      );
    }

    const quiz = await LMSQuizModel.findOne({
      where: { id: quizId, courseId },
    });

    if (!quiz) {
      throw new HttpException('Quiz not found', HttpStatus.NOT_FOUND);
    }

    const previewQuiz = {
      ...quiz,
      accessLevel: accessLevel,
    };

    const content =
      this.integrationService.formatQuizContentPreview(previewQuiz);

    return { content };
  }

  @Post(':courseId/quizzes/bulk-sync')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async bulkUpdateQuizSync(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { action: 'enable' | 'disable'; quizIds?: number[] },
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: { courseId },
      relations: { orgIntegration: true },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if quiz resource is enabled
    const selectedResources: LMSResourceType[] =
      integration.selectedResourceTypes;
    if (!selectedResources.includes(LMSResourceType.QUIZZES)) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.resourceDisabled,
      );
    }

    try {
      if (body.action === 'disable') {
        // If specific quiz IDs provided, disable only those; otherwise disable all
        const whereCondition = body.quizIds
          ? { courseId, id: In(body.quizIds) }
          : { courseId };

        const quizzesToDisable = await LMSQuizModel.find({
          where: whereCondition,
        });

        let failures = 0;

        for (const quiz of quizzesToDisable) {
          if (quiz.chatbotDocumentId) {
            try {
              await this.integrationService.singleDocOperation(
                courseId,
                quiz,
                LMSUpload.Quizzes,
                'Clear',
              );
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_err) {
              failures++;
              // Continue with other quizzes even if one fails
            }
          }
        }

        // Now disable sync for the quizzes
        await LMSQuizModel.update(whereCondition, {
          syncEnabled: false,
        });

        const count = body.quizIds
          ? body.quizIds.length
          : quizzesToDisable.length;
        const successMsg =
          count - failures > 0
            ? `Successfully disabled sync for ${count - failures} quiz${count - failures !== 1 ? 'es' : ''}.`
            : '';
        const failureMsg =
          failures > 0
            ? ` Failed to disable sync for ${failures} quiz${failures !== 1 ? 'es' : ''}.`
            : '';
        return (successMsg + failureMsg).trim();
      } else {
        if (!body.quizIds || body.quizIds.length === 0) {
          throw new BadRequestException('Quiz IDs required for enable action');
        }

        await LMSQuizModel.update(
          { courseId, id: In(body.quizIds) },
          { syncEnabled: true },
        );

        const enabledQuizzes = await LMSQuizModel.find({
          where: { courseId, id: In(body.quizIds) },
        });

        for (const quiz of enabledQuizzes) {
          await this.integrationService.singleDocOperation(
            courseId,
            quiz,
            LMSUpload.Quizzes,
            'Sync',
          );
        }

        return `Successfully enabled sync for ${body.quizIds.length} quiz${body.quizIds.length !== 1 ? 'es' : ''}`;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.failedToUpdateQuizSync,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':courseId/quizzes')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getQuizzes(@Param('courseId', ParseIntPipe) courseId: number) {
    // Check if quiz resource is enabled
    const integration = await LMSCourseIntegrationModel.findOne({
      where: { courseId },
      relations: { orgIntegration: true },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const selectedResources: LMSResourceType[] =
      integration.selectedResourceTypes;
    if (!selectedResources.includes(LMSResourceType.QUIZZES)) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.resourceDisabled,
      );
    }

    return await this.integrationService.getItems(courseId, LMSGet.Quizzes);
  }

  @Post(':courseId/test')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async testLMSIntegration(
    @UserId() userId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: TestLMSIntegrationParams,
  ): Promise<LMSApiResponseStatus> {
    const orgCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId: courseId,
      },
    });
    if (!orgCourse) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      where: {
        organizationId: orgCourse.organizationId,
        apiPlatform: props.apiPlatform,
      },
    });
    if (!orgIntegration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const token = await LMSAccessTokenModel.findOne({
      where: {
        id: props.accessTokenId,
      },
    });

    if (!props.apiKey && !token) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.missingApiKeyOrToken,
      );
    }

    if (token && token.userId != userId) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.lmsController.unauthorizedForToken,
      );
    }

    return await this.integrationService.testConnection(
      orgIntegration,
      props.apiCourseId,
      props.apiKey,
      token,
    );
  }

  @Post(':courseId/sync')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async toggleSynchronizeCourse(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: {
        courseId: courseId,
      },
      relations: {
        orgIntegration: true,
      },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const newState = !integration.lmsSynchronize;
    if (newState) {
      await this.integrationService.syncDocuments(integration.courseId);
    }
    await LMSCourseIntegrationModel.update(
      { courseId: integration.courseId },
      { lmsSynchronize: newState },
    );

    return `Successfully ${newState ? 'enabled' : 'disabled'} synchronization with ${integration.orgIntegration.apiPlatform ?? 'LMS'}.`;
  }

  @Post(':courseId/sync/force')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async forceSynchronizeCourse(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<LMSSyncDocumentsResult> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: {
        courseId: courseId,
      },
      relations: {
        orgIntegration: true,
      },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!integration.lmsSynchronize) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.syncDisabled,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      return await this.integrationService.syncDocuments(courseId);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.lmsController.failedToSync,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    //return `Successfully forced synchronization with ${integration.orgIntegration.apiPlatform ?? 'LMS'} course.`;
  }

  @Delete(':courseId/sync/clear')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async clearDocuments(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: {
        courseId: courseId,
      },
      relations: {
        orgIntegration: true,
      },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    try {
      await this.integrationService.clearDocuments(courseId);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.lmsController.failedToClear,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return `Successfully cleared documents from ${integration.orgIntegration.apiPlatform ?? 'LMS'} in HelpMe.`;
  }

  @Post(':courseId/sync/:docType/:itemId/toggle')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async toggleSyncDocument(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('docType')
    docType: 'assignment' | 'announcement' | 'page' | 'file' | 'quiz',
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body()
    params?: LMSAssignment | LMSAnnouncement | LMSPage | LMSFile | LMSQuiz,
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: {
        courseId: courseId,
      },
      relations: {
        orgIntegration: true,
      },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    let uploadType: LMSUpload;
    switch (docType) {
      case 'assignment':
        uploadType = LMSUpload.Assignments;
        break;
      case 'announcement':
        uploadType = LMSUpload.Announcements;
        break;
      case 'page':
        uploadType = LMSUpload.Pages;
        break;
      case 'file':
        uploadType = LMSUpload.Files;
        break;
      case 'quiz':
        uploadType = LMSUpload.Quizzes;
        break;
      default:
        throw new BadRequestException(
          ERROR_MESSAGES.lmsController.invalidDocumentType,
        );
    }

    const selectedResources: LMSResourceType[] =
      integration.selectedResourceTypes;
    if (
      !selectedResources.includes(
        this.integrationService.LMSUploadToResourceType[uploadType],
      )
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.resourceDisabled,
      );
    }

    const model = await this.integrationService.getDocumentModel(uploadType);
    let item = await (model as any).findOne({
      where: {
        id: itemId,
      },
    });
    let didNotExist = false;

    if (!item && params != undefined) {
      didNotExist = true;
      const createParams = {
        ...params,
        id: itemId,
        courseId: courseId,
        modified:
          params.modified != undefined ? new Date(params.modified) : new Date(),
        lmsSource: integration.orgIntegration.apiPlatform,
      };
      if (uploadType == LMSUpload.Announcements) {
        createParams['posted'] = new Date(createParams['posted']);
      }
      item = (model as any).create(createParams);
    } else if (!item) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsDocumentNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const newState = didNotExist ? true : !item.syncEnabled;

    if (newState && !integration.lmsSynchronize) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.cannotSyncDocumentWhenSyncDisabled,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.integrationService.singleDocOperation(
        courseId,
        item,
        uploadType,
        newState ? 'Sync' : 'Clear',
      );

      if (!result) {
        throw new Error();
      }
    } catch (err) {
      console.error(err);
      throw new HttpException(
        newState
          ? ERROR_MESSAGES.lmsController.failedToSyncOne
          : ERROR_MESSAGES.lmsController.failedToClearOne,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return `Successfully ${newState ? 'synced' : 'cleared'} document from ${integration.orgIntegration.apiPlatform ?? 'LMS'} in HelpMe.`;
  }

  @Post(':courseId/quiz/:quizId/access-level')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async updateQuizAccessLevel(
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() body: { accessLevel: LMSQuizAccessLevel },
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: { courseId },
      relations: { orgIntegration: true },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check if quiz resource is enabled
    const selectedResources: LMSResourceType[] =
      integration.selectedResourceTypes;
    if (!selectedResources.includes(LMSResourceType.QUIZZES)) {
      throw new BadRequestException(
        ERROR_MESSAGES.lmsController.resourceDisabled,
      );
    }

    try {
      const result = await this.integrationService.updateQuizAccessLevel(
        courseId,
        quizId,
        body.accessLevel,
      );

      if (!result) {
        throw new Error('Failed to update access level');
      }
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Failed to update quiz access level',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return `Successfully updated quiz access level to ${body.accessLevel}`;
  }

  @Post('course/:courseId/resources')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async updateSelectedResourceTypes(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { selectedResourceTypes: string[] },
  ): Promise<string> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: { courseId },
      relations: { orgIntegration: true },
    });

    if (!integration) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const validTypes = Object.values(LMSResourceType);
    const filteredTypes = (body.selectedResourceTypes || []).filter((t) =>
      validTypes.includes(t as LMSResourceType),
    );

    if (filteredTypes.length === 0) {
      throw new HttpException(
        'No valid resource types provided.',
        HttpStatus.BAD_REQUEST,
      );
    }

    integration.selectedResourceTypes = filteredTypes as LMSResourceType[];
    await LMSCourseIntegrationModel.save(integration);

    return `Successfully updated selected resource types for course ${courseId}.`;
  }
}
