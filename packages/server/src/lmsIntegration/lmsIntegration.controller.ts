import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  Role,
} from '@koh/common';
import {
  LMSGet,
  LMSIntegrationService,
  LMSSave,
} from './lmsIntegration.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { OrganizationCourseModel } from '../organization/organization-course.entity';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';

@Controller('lms_integration')
export class LMSIntegrationController {
  constructor(private integrationService: LMSIntegrationService) {}

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
      return LMSApiResponseStatus.InvalidConfiguration;
    }

    const orgIntegration = await LMSOrganizationIntegrationModel.findOne({
      organizationId: orgCourse.organizationId,
      apiPlatform: props.apiPlatform,
    });
    if (!orgIntegration) {
      return LMSApiResponseStatus.InvalidConfiguration;
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
  ): Promise<{ status: LMSApiResponseStatus; assignments: LMSAssignment[] }> {
    return await this.integrationService.saveItems(
      courseId,
      LMSSave.Assignments,
      props.ids,
    );
  }

  @Post(':courseId/announcements/save')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async saveAnnouncements(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<{
    status: LMSApiResponseStatus;
    announcements: LMSAnnouncement[];
  }> {
    return await this.integrationService.saveItems(
      courseId,
      LMSSave.Announcements,
      props.ids,
    );
  }

  @Post(':courseId/assignments/upload')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async uploadAssignments(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<any> {
    return await this.integrationService.uploadAssignments(props.ids);
  }

  @Post(':courseId/announcements/upload')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async uploadAnnouncements(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() props: any,
  ): Promise<any> {
    return await this.integrationService.uploadAnnouncements(props.ids);
  }
}
