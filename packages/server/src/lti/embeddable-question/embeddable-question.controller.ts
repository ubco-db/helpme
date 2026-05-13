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
} from '@nestjs/common'
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'
import { CourseRolesGuard } from '../../guards/course-roles.guard'
import { Roles } from '../../decorators/roles.decorator'
import {
  CreateEmbeddableQuestionParams,
  EmbeddableQuestionFeedback,
  EmbeddableQuestionFeedbackParams,
  EmbeddableQuestionFeedbackResponse,
  Role,
  UpdateEmbeddableFeedbackParams,
  UpdateEmbeddableQuestionParams,
} from '@koh/common'
import { EmbeddableQuestionService } from './embeddable-question.service'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { UserId } from '../../decorators/user.decorator'

@Controller('lti/embeddable-question')
@UseInterceptors(ClassSerializerInterceptor)
export class EmbeddableQuestionController {
  constructor(
    private embeddableQuestionService: EmbeddableQuestionService,
  ) {}

  /**
   * Lists all embeddable questions for a course, accessible to professor/TA role only
   * @param courseId
   */
  @Get(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(@Param('courseId', ParseIntPipe) courseId: number): Promise<EmbeddableQuestionModel[]> {
    return await this.embeddableQuestionService.findAllForCourse(courseId);
  }

  /**
   * Retrieves a single question from a course. Accessible to all course roles.
   * @param courseId
   * @param questionId
   */
  @Get(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<EmbeddableQuestionModel> {
    return await this.embeddableQuestionService.findOne(questionId);
  }

  /**
   * Calls upon chatbot service to generate feedback for a student's response to a given embeddable question.
   * @param courseId
   * @param questionId
   * @param body Contains the student response.
   * @param userId User who is prompting for feedback
   */
  @Post(':courseId/:questionId/feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: EmbeddableQuestionFeedbackParams,
    @UserId() userId: number,
  ): Promise<EmbeddableQuestionFeedbackResponse> {
    const responseText = body.responseText?.trim();
    if (!responseText) {
      throw new BadRequestException('Input is required');
    }

    const feedback = await this.embeddableQuestionService.getFeedback(
      responseText,
      questionId,
      courseId,
      userId
    );

    return {
      feedback: feedback.aiFeedback,
      grade: feedback.aiGrade,
    }
  }

  /**
   * For creating a new embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param body Parameters for creating the embeddable question.
   */
  @Post(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: CreateEmbeddableQuestionParams,
  ): Promise<EmbeddableQuestionModel> {
    return await this.embeddableQuestionService.upsert(
      courseId,
      body,
    );
  }

  /**
   * For updating an new embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param questionId
   * @param body Parameters for updating the embeddable question.
   */
  @Patch(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateEmbeddableQuestionParams,
  ): Promise<EmbeddableQuestionModel>  {
    return await this.embeddableQuestionService.upsert(
      courseId,
      body,
      questionId,
    );
  }

  /**
   * For deleting an embeddable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param questionId
   */
  @Delete(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<void> {
    await this.embeddableQuestionService.delete(questionId);
  }

  /**
   * For retrieving feedback from a given editable question. Accessible to TA and Professor roles only.
   * @param courseId
   * @param questionId
   * @param users For filtering to specific group of users
   */
  @Get(':courseId/:questionId/answers')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getAnswers(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Query('users', new ParseArrayPipe({ items: Number, optional: true })) users?: number[],
  ): Promise<EmbeddableQuestionFeedback[]> {
    return await this.embeddableQuestionService.getAnswers(questionId, users)
  }

  @Patch(':courseId/:questionId/answers/:answerId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async updateAnswer(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() body: UpdateEmbeddableFeedbackParams
  ): Promise<void> {
    await this.embeddableQuestionService.updateAnswer(answerId,body);
  }

  @Delete(':courseId/:questionId/answers/:answerId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteAnswer(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('answerId', ParseIntPipe) answerId: number,
  ): Promise<void> {
    await this.embeddableQuestionService.deleteAnswer(answerId);
  }

  // @Get(':courseId/export')
  // @UseGuards(JwtAuthGuard, CourseRolesGuard)
  // @Roles(Role.TA, Role.PROFESSOR)
  // async exportAnswers(
  //   @Res() response,
  //   @Param('courseId', ParseIntPipe) courseId: number,
  //   @Query('q', new ParseArrayPipe({ items: Number, optional: true })) questions?: number[],
  //   @Query('u', new ParseArrayPipe({ items: Number, optional: true })) users?: number[],
  //   @Query('latestOnly', ParseBoolPipe) latestOnly?: boolean
  // ): Promise<any> {
  //
  // }
}
