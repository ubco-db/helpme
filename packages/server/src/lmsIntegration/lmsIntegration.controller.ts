import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import {
  ERROR_MESSAGES,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSAnnouncement,
  LMSCourseIntegrationPartial,
  LMSFile,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  LMSQuiz,
  LMSQuizAccessLevel,
  LMSResourceType,
  OrganizationRole,
  RemoveLMSOrganizationParams,
  Role,
  TestLMSIntegrationParams,
  UpsertLMSCourseParams,
  UpsertLMSOrganizationParams,
  LMSSyncDocumentsResult,
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
import { User } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from '../guards/organization.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { LMSQuizModel } from './lmsQuiz.entity';
import { In } from 'typeorm';

@Controller('lms')
export class LMSIntegrationController {
  constructor(private integrationService: LMSIntegrationService) {}

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

    const { apiPlatform, rootUrl } = props;

    if (props.rootUrl == undefined)
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsIntegrationUrlRequired,
        HttpStatus.BAD_REQUEST,
      );

    if (props.rootUrl.startsWith('https') || props.rootUrl.startsWith('http'))
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsIntegrationProtocolIncluded,
        HttpStatus.BAD_REQUEST,
      );

    return await this.integrationService.upsertOrganizationLMSIntegration(
      oid,
      rootUrl,
      apiPlatform,
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
    @User() _user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: UpsertLMSCourseParams,
  ): Promise<any> {
    const orgCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId: courseId,
      },
    });
    if (!orgCourse) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.organizationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const {
      apiPlatform,
      apiCourseId,
      apiKey,
      apiKeyExpiry,
      apiKeyExpiryDeleted,
    } = props;

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      where: {
        organizationId: orgCourse.organizationId,
        apiPlatform: apiPlatform,
      },
    });
    if (!orgIntegration) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.orgIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const courseIntegration = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
      relations: ['orgIntegration'],
    });

    if (courseIntegration != undefined) {
      return await this.integrationService.updateCourseLMSIntegration(
        courseIntegration,
        orgIntegration,
        apiKeyExpiryDeleted,
        apiCourseId,
        apiKey,
        apiKeyExpiry,
      );
    } else {
      return await this.integrationService.createCourseLMSIntegration(
        orgIntegration,
        courseId,
        apiCourseId,
        apiKey,
        apiKeyExpiry,
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
              const result = await this.integrationService.singleDocOperation(
                courseId,
                quiz,
                LMSUpload.Quizzes,
                'Clear',
              );
            } catch (error) {
failures++;
              // Continue with other quizzes even if one fails
            }
          }
        }

        // Now disable sync for the quizzes
        const result = await LMSQuizModel.update(whereCondition, {
          syncEnabled: false,
        });

        const count = body.quizIds
          ? body.quizIds.length
          : quizzesToDisable.length;
const successMsg = count - failures > 0 ?  `Successfully disabled sync for ${count-failures} quiz${count-failures !== 1 ? 'es' : ''}.` : ''; 
const failureMsg = $failures > 0 ? ` Failed to disable sync for ${failures} quiz${failures !== 1 ? 'es' : ''}.` : '';
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
    } catch (error) {
      throw new HttpException(
        'Failed to update quiz sync settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':courseId/quizzes')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getQuizzes(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.integrationService.getItems(courseId, LMSGet.Quizzes);
  }

  @Post(':courseId/test')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async testLmsIntegration(
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

    return await this.integrationService.testConnection(
      orgIntegration,
      props.apiKey,
      props.apiCourseId,
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
