import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  EmbeddableQuestionFeedback,
  EmbeddableQuestionFeedbackParams,
  Role,
  UpsertEmbeddableQuestionParams,
} from '@koh/common';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../../../guards/course-roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { EmbeddableQuestionService } from './embeddable-question.service';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { UserId } from '../../../decorators/user.decorator';

@Controller('lti/embeddable-question')
@UseGuards(JwtAuthGuard, CourseRolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class EmbeddableQuestionController {
  constructor(
    private readonly embeddableQuestionService: EmbeddableQuestionService,
  ) {}

  @Get(':courseId')
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<EmbeddableQuestionModel[]> {
    return this.embeddableQuestionService.findAllForCourse(courseId);
  }

  @Get(':courseId/:questionId')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return this.embeddableQuestionService.getStudentQuestion(
      courseId,
      questionId,
    );
  }

  @Post(':courseId/:questionId/feedback')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: EmbeddableQuestionFeedbackParams,
    @UserId() userId: number,
  ): Promise<EmbeddableQuestionFeedback> {
    return this.embeddableQuestionService.getFeedback({
      submission: body.responseText,
      questionId,
      courseId,
      userId,
    });
  }

  @Post(':courseId')
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: UpsertEmbeddableQuestionParams,
  ): Promise<EmbeddableQuestionModel> {
    return this.embeddableQuestionService.upsert(courseId, body);
  }

  @Patch(':courseId/:questionId')
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpsertEmbeddableQuestionParams,
  ): Promise<EmbeddableQuestionModel> {
    return this.embeddableQuestionService.upsert(courseId, body, questionId);
  }

  @Delete(':courseId/:questionId')
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<void> {
    return this.embeddableQuestionService.delete(courseId, questionId);
  }
}
