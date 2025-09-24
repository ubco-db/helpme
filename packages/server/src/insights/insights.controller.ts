import { InsightsService } from './insights.service';
import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  ERROR_MESSAGES,
  GetInsightOutputResponse,
  InsightDashboardPartial,
  InsightDetail,
  InsightObject,
  InsightOutput,
  InsightType,
  ListInsightsResponse,
  Role,
  TableOutputType,
} from '@koh/common';
import { User } from '../decorators/user.decorator';
import { Filter, INSIGHTS_MAP } from './insight-objects';
import { UserModel } from 'profile/user.entity';
import { Roles } from 'decorators/roles.decorator';
import { CourseRole } from '../decorators/course-role.decorator';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseModel } from '../course/course.entity';

@Controller('insights')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Delete(':courseId/dashboard/remove')
  @Roles(Role.PROFESSOR)
  async removeDashboardPreset(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { name: string },
    @User() user: UserModel,
  ): Promise<InsightDashboardPartial[]> {
    const userCourse = await UserCourseModel.findOne({
      where: { courseId: courseId, userId: user.id },
    });
    // Check that the current user's role has access to dashboards
    if (userCourse?.role != Role.PROFESSOR) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.dashboardUnauthorized,
      );
    }

    return await this.insightsService.removeDashboardPreset(
      user,
      courseId,
      body.name,
    );
  }

  @Post(':courseId/dashboard/create')
  @Roles(Role.PROFESSOR)
  async upsertDashboardPreset(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User() user: UserModel,
    @Body()
    body: {
      insights: InsightDetail;
      name?: string;
    },
  ): Promise<InsightDashboardPartial[]> {
    const userCourse = await UserCourseModel.findOne({
      where: { courseId: courseId, userId: user.id },
    });
    // Check that the current user's role has access to dashboards
    if (userCourse?.role != Role.PROFESSOR) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.dashboardUnauthorized,
      );
    }

    return await this.insightsService.upsertDashboardPreset(
      user,
      courseId,
      body.insights,
      body.name,
    );
  }

  @Get(':courseId/dashboard')
  @Roles(Role.PROFESSOR)
  async retrieveDashboardPresets(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User() user: UserModel,
  ): Promise<InsightDashboardPartial[]> {
    const userCourse = await UserCourseModel.findOne({
      where: { courseId: courseId, userId: user.id },
    });
    // Check that the current user's role has access to dashboards
    if (userCourse?.role != Role.PROFESSOR) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.dashboardUnauthorized,
      );
    }

    return await this.insightsService.getDashboardPresets(user, courseId);
  }

  @Get(':courseId/:insightName')
  async get(
    @CourseRole() role: Role,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('insightName') insightName: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit', ParseIntPipe) limit?: number,
    @Query('offset', ParseIntPipe) offset?: number,
    @Query('students', new ParseArrayPipe({ optional: true, separator: ',' }))
    students?: number[],
    @Query('queues', new ParseArrayPipe({ optional: true, separator: ',' }))
    queues?: number[],
    @Query('staff', new ParseArrayPipe({ optional: true, separator: ',' }))
    staff?: number[],
  ): Promise<GetInsightOutputResponse> {
    // Temporarily disabling insights until we finish refactoring QueueModel
    // Check that the insight name is valid
    const insightNames = Object.keys(INSIGHTS_MAP);
    if (!insightNames.includes(insightName)) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.insightNameNotFound,
      );
    }

    const targetInsight: InsightObject = INSIGHTS_MAP[insightName];
    // Check that the current user's role has access to the given insight
    if (!targetInsight.roles.includes(role)) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.insightUnathorized,
      );
    }

    // Initialize filters with a courseId filter since all insights are filtered by courseId
    const filters: Filter[] = [
      {
        type: 'courseId',
        courseId,
      },
    ];
    // Check if the time range filters exist and add them if so
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new BadRequestException(
          ERROR_MESSAGES.insightsController.invalidDateRange,
        );
      }

      filters.push({
        type: 'timeframe',
        start: startDate,
        end: endDate,
      });
    }

    if (students) {
      students.forEach((n) => {
        if (isNaN(n)) {
          throw new BadRequestException(
            ERROR_MESSAGES.insightsController.invalidStudentID,
          );
        }
      });

      filters.push({
        type: 'students',
        studentIds: students,
      });
    }

    if (queues) {
      queues.forEach((n) => {
        if (isNaN(n)) {
          throw new BadRequestException(
            ERROR_MESSAGES.insightsController.invalidQueueID,
          );
        }
      });

      filters.push({
        type: 'queues',
        queueIds: queues,
      });
    }

    if (staff) {
      staff.forEach((n) => {
        if (isNaN(n)) {
          throw new BadRequestException(
            ERROR_MESSAGES.insightsController.invalidStaffID,
          );
        }
      });

      filters.push({
        type: 'staff',
        staffIds: staff,
      });
    }

    const courseTimezone = (
      await CourseModel.findOne({ where: { id: courseId } })
    )?.timezone;

    let insight = await this.insightsService.computeOutput({
      insight: targetInsight,
      filters,
      timeZone: courseTimezone,
    });

    if (targetInsight.insightType == InsightType.Table) {
      let data = (insight as TableOutputType).data;
      if (offset) {
        data = data.slice(offset, data.length);
      }
      if (limit) {
        data = data.slice(0, limit);
      }
      insight = { ...(insight as TableOutputType), data };
    }

    return {
      title: targetInsight.displayName,
      description: targetInsight.description,
      allowedFilters: targetInsight.allowedFilters,
      outputType: targetInsight.insightType,
      output: insight,
    } as InsightOutput;
  }

  @Get('list')
  @Roles(Role.PROFESSOR)
  async getAllInsights(): Promise<ListInsightsResponse> {
    return this.insightsService.convertToInsightsListResponse(
      Object.keys(INSIGHTS_MAP),
    );
  }

  @Patch('')
  @Roles(Role.PROFESSOR)
  async toggleInsightOn(
    @Body() body: { insightName: string },
    @User() user: UserModel,
  ): Promise<void> {
    await this.insightsService.toggleInsightOn(user, body.insightName);
    return;
  }

  @Delete('')
  @Roles(Role.PROFESSOR)
  async toggleInsightOff(
    @Body() body: { insightName: string },
    @User() user: UserModel,
  ): Promise<void> {
    // Temporarily disabling insights until we finish refactoring QueueModel
    await this.insightsService.toggleInsightOff(user, body.insightName);
    return;
  }
}
