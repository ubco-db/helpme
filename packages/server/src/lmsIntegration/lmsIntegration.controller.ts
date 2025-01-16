import {
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
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseIntegrationPartial,
  LMSFileUploadResult,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  OrganizationRole,
  Role,
} from '@koh/common';
import {
  LMSGet,
  LMSIntegrationService,
  LMSSave,
  LMSUpload,
} from './lmsIntegration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationCourseModel } from '../organization/organization-course.entity';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { User } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from '../guards/organization.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';

@Controller('lms_integration')
export class LMSIntegrationController {
  constructor(private integrationService: LMSIntegrationService) {}

  @Get('organization_integrations/:organizationId/lms_integration')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async getOrganizationLMSIntegrations(
    @Param('organizationId', ParseIntPipe) oid: number,
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

  @Post('organization_integrations/:organizationId/upsert')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async upsertOrganizationLMSIntegration(
    @Param('organizationId', ParseIntPipe) oid: number,
    @Body() props: any,
  ): Promise<string> {
    if (!Object.keys(LMSIntegrationPlatform).includes(props.apiPlatform))
      throw new HttpException(
        ERROR_MESSAGES.organizationController.lmsIntegrationInvalidPlatform,
        HttpStatus.BAD_REQUEST,
      );

    if (props.rootUrl == undefined)
      throw new HttpException(
        ERROR_MESSAGES.organizationController.lmsIntegrationUrlRequired,
        HttpStatus.BAD_REQUEST,
      );

    if (props.rootUrl.startsWith('https') || props.rootUrl.startsWith('http'))
      throw new HttpException(
        ERROR_MESSAGES.organizationController.lmsIntegrationProtocolIncluded,
        HttpStatus.BAD_REQUEST,
      );

    return await this.integrationService.upsertOrganizationLMSIntegration(
      oid,
      props,
    );
  }

  @Delete('organization_integrations/:organizationId/remove')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async removeOrganizationLMSIntegration(
    @Param('organizationId', ParseIntPipe) oid: number,
    @Body() body: any,
  ): Promise<string> {
    const exists = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: oid, apiPlatform: body.apiPlatform },
    });

    if (!exists)
      throw new HttpException(
        ERROR_MESSAGES.organizationController.lmsIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );

    const courses = await LMSCourseIntegrationModel.find({
      where: { orgIntegration: exists },
    });
    for (const course of courses) {
      await this.integrationService.clearLMSIntegrationData(course.courseId);
    }

    const platform = exists.apiPlatform;
    await LMSOrganizationIntegrationModel.remove(exists);
    return `Successfully deleted LMS integration for ${platform}`;
  }

  @Get('course_integration/:courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getCourseLMSIntegration(
    @Param(':courseId', ParseIntPipe) courseId: number,
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

  @Post('course_integration/:courseId/upsert')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async upsertCourseLMSIntegration(
    @Param(':courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<any> {
    const orgCourse = await OrganizationCourseModel.findOne({
      courseId: courseId,
    });
    if (!orgCourse) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.organizationNotFound,
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
        ERROR_MESSAGES.courseController.orgIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const courseIntegration = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
    });

    if (courseIntegration != undefined) {
      return await this.integrationService.updateCourseLMSIntegration(
        courseIntegration,
        orgIntegration,
        props.apiKeyExpiryDeleted,
        props.apiCourseId,
        props.apiKey,
        props.apiKeyExpiry,
      );
    } else {
      return await this.integrationService.createCourseLMSIntegration(
        orgIntegration,
        courseId,
        props.apiCourseId,
        props.apiKey,
        props.apiKeyExpiry,
      );
    }
  }

  @Delete('course_integration/:courseId/remove')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async removeCourseLMSIntegration(
    @Param(':courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<any> {
    const orgCourse = await OrganizationCourseModel.findOne({
      courseId: courseId,
    });
    if (!orgCourse) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.organizationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      organizationId: orgCourse.organizationId,
      apiPlatform: props.apiPlatform,
    });
    if (!orgIntegration) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.orgIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const exists = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId, orgIntegration: orgIntegration },
    });
    if (!exists) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.lmsIntegrationNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.integrationService.clearLMSIntegrationData(courseId);
    await LMSCourseIntegrationModel.remove(exists);
    return `Successfully disconnected LMS integration`;
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

  @Post(':courseId/test')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async testLmsIntegration(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<LMSApiResponseStatus> {
    const orgCourse = await OrganizationCourseModel.findOne({
      courseId: courseId,
    });
    if (!orgCourse) {
      throw new HttpException(
        LMSApiResponseStatus.InvalidConfiguration,
        HttpStatus.NOT_FOUND,
      );
    }

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      organizationId: orgCourse.organizationId,
      apiPlatform: props.apiPlatform,
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

  @Post(':courseId/assignments/save')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async saveAssignments(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<LMSAssignment[]> {
    return (await this.integrationService.saveItems(
      courseId,
      LMSSave.Assignments,
      props.ids,
    )) as LMSAssignment[];
  }

  @Post(':courseId/announcements/save')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async saveAnnouncements(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<LMSAnnouncement[]> {
    return (await this.integrationService.saveItems(
      courseId,
      LMSSave.Announcements,
      props.ids,
    )) as LMSAnnouncement[];
  }

  @Post(':courseId/assignments/upload')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async uploadAssignments(
    @User() user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<LMSFileUploadResult[]> {
    return await this.integrationService.uploadDocuments(
      user,
      courseId,
      LMSUpload.Assignments,
      props.ids,
    );
  }

  @Post(':courseId/announcements/upload')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async uploadAnnouncements(
    @User() user: UserModel,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<LMSFileUploadResult[]> {
    return await this.integrationService.uploadDocuments(
      user,
      courseId,
      LMSUpload.Announcements,
      props.ids,
    );
  }
}
