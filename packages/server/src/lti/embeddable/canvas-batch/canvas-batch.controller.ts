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
  CanvasBatchQuizOption,
  CanvasBatchRunReport,
  CanvasBatchRunSummary,
  Role,
  StartCanvasBatchRunParams,
} from '@koh/common';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../../../guards/course-roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { UserId } from '../../../decorators/user.decorator';
import { CanvasBatchService } from './canvas-batch.service';

/**
 * Staff-only (professor/TA) endpoints for Classic Canvas batch grading.
 *
 * Starting a run is the only action that changes anything; it owns the
 * SpeedGrader prefill. There is no post/release endpoint because HelpMe never
 * posts grades.
 */
@Controller('lti/embeddable/canvas-batch')
@UseGuards(JwtAuthGuard, CourseRolesGuard)
export class CanvasBatchController {
  constructor(private readonly canvasBatchService: CanvasBatchService) {}

  @Get(':courseId/quizzes')
  @Roles(Role.TA, Role.PROFESSOR)
  async listQuizzes(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CanvasBatchQuizOption[]> {
    return this.canvasBatchService.listClassicQuizzes(courseId);
  }

  @Get(':courseId/runs')
  @Roles(Role.TA, Role.PROFESSOR)
  async listRuns(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<CanvasBatchRunSummary[]> {
    return this.canvasBatchService.listRuns(courseId);
  }

  @Post(':courseId/runs')
  @Roles(Role.TA, Role.PROFESSOR)
  async start(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: StartCanvasBatchRunParams,
    @UserId() userId: number,
  ): Promise<CanvasBatchRunSummary> {
    return this.canvasBatchService.startRun(courseId, userId, body);
  }

  @Get(':courseId/runs/:runId/report')
  @Roles(Role.TA, Role.PROFESSOR)
  async getReport(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('runId', ParseIntPipe) runId: number,
  ): Promise<CanvasBatchRunReport> {
    return this.canvasBatchService.getReport(courseId, runId);
  }
}
