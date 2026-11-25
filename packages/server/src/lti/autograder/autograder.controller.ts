import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AutograderQuizOption,
  AutograderRunReport,
  AutograderRunSummary,
  Role,
  StartAutograderRunParams,
  StartAutograderRunResponse,
} from '@koh/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../../guards/course-roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserId } from '../../decorators/user.decorator';
import { AutograderService } from './autograder.service';

/**
 * Staff-only endpoints for the LMS autograder.
 *
 * Starting a run owns discovery, grading, and the SpeedGrader prefill.
 * Cancelling stops it at the next attempt boundary. There is no post/release
 * endpoint because HelpMe never posts grades.
 */
@Controller('lti/embeddable/autograder')
@UseGuards(JwtAuthGuard, CourseRolesGuard)
export class AutograderController {
  constructor(private readonly autograderService: AutograderService) {}

  @Get(':courseId/quizzes')
  @Roles(Role.TA, Role.PROFESSOR)
  async listQuizzes(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<AutograderQuizOption[]> {
    return this.autograderService.listQuizzes(courseId);
  }

  @Get(':courseId/runs')
  @Roles(Role.TA, Role.PROFESSOR)
  async listRuns(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<AutograderRunSummary[]> {
    return this.autograderService.listRuns(courseId);
  }

  @Post(':courseId/runs')
  @Roles(Role.TA, Role.PROFESSOR)
  async start(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: StartAutograderRunParams,
    @UserId() userId: number,
  ): Promise<StartAutograderRunResponse> {
    return this.autograderService.startRun(courseId, userId, body);
  }

  @Post(':courseId/runs/:runId/cancel')
  @Roles(Role.TA, Role.PROFESSOR)
  async cancel(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('runId', ParseIntPipe) runId: number,
  ): Promise<AutograderRunSummary> {
    return this.autograderService.cancelRun(courseId, runId);
  }

  @Get(':courseId/runs/:runId/report')
  @Roles(Role.TA, Role.PROFESSOR)
  async getReport(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('runId', ParseIntPipe) runId: number,
  ): Promise<AutograderRunReport> {
    return this.autograderService.getReport(courseId, runId);
  }
}
