import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Get } from '@nestjs/common/decorators';
import { LMSApiResponseStatus, Role } from '@koh/common';
import { LMSIntegrationService } from './lmsIntegration.service';
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
    return this.integrationService.getCourse(courseId);
  }

  @Get(':courseId/students')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getStudents(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.integrationService.getStudents(courseId);
  }

  @Get(':courseId/assignments')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async getAssignments(@Param('courseId', ParseIntPipe) courseId: number) {
    return this.integrationService.getAssignments(courseId);
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
}
