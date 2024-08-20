import { InsightsService } from './insights.service';
import {
  Controller,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  Get,
  Param,
  Query,
  BadRequestException,
  Body,
  Delete,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import {
  GetInsightOutputResponse,
  ERROR_MESSAGES,
  ListInsightsResponse,
  Role,
  SimpleTableOutputType,
} from '@koh/common';
import { User } from '../decorators/user.decorator';
import { INSIGHTS_MAP } from './insight-objects';
import { UserModel } from 'profile/user.entity';
import { Roles } from 'decorators/roles.decorator';
import { CourseRole } from '../decorators/course-role.decorator';
import { Filter } from './insight-objects';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';

@Controller('insights')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get(':courseId/:insightName')
  async get(
    @CourseRole() role: Role,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('insightName') insightName: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('limit', ParseIntPipe) limit: number,
    @Query('offset', ParseIntPipe) offset: number,
  ): Promise<GetInsightOutputResponse> {
    // Temporarily disabling insights until we finish refactoring QueueModel
    // Check that the insight name is valid
    const insightNames = Object.keys(INSIGHTS_MAP);
    if (!insightNames.includes(insightName)) {
      throw new BadRequestException(
        ERROR_MESSAGES.insightsController.insightNameNotFound,
      );
    }
    // Check that the current user's role has access to the given insight
    if (!INSIGHTS_MAP[insightName].roles.includes(role)) {
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

    let insight = await this.insightsService.computeOutput({
      insight: INSIGHTS_MAP[insightName],
      filters,
    });

    if (insightName === 'MostActiveStudents') {
      let dataSource = (insight as SimpleTableOutputType).dataSource;
      if (offset) {
        dataSource = dataSource.slice(offset, dataSource.length);
      }
      if (limit) {
        dataSource = dataSource.slice(0, limit);
      }
      insight = { ...(insight as SimpleTableOutputType), dataSource };
    }

    return insight;
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
