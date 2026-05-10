import {
  BadRequestException,
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
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../../guards/course-roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import {
  CreateEmbeddableQuestionParams,
  EmbeddableQuestionFeedbackParams,
  EmbeddableQuestionFeedbackResponse,
  Role,
  UpdateEmbeddableQuestionParams,
} from '@koh/common';
import { EmbeddableQuestionService } from './embeddable-question.service';
import { ChatbotApiService } from '../../chatbot/chatbot-api.service';
import { EmbeddableQuestionModel } from './embeddable-question.entity'

@Controller('lti/embeddable-question')
@UseInterceptors(ClassSerializerInterceptor)
export class EmbeddableQuestionController {
  constructor(
    private embeddableQuestionService: EmbeddableQuestionService,
    private chatbotApiService: ChatbotApiService,
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
   */
  @Post(':courseId/:questionId/feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: EmbeddableQuestionFeedbackParams,
  ): Promise<EmbeddableQuestionFeedbackResponse> {
    const responseText = body.responseText?.trim();
    if (!responseText) {
      throw new BadRequestException('Input is required');
    }

    const question = await this.embeddableQuestionService.findOne(
      questionId,
    );

    const feedback = await this.chatbotApiService.queryChatbot(
      responseText,
      '',
      'feedback',
      {
        question: question.questionText,
        criteria: question.criteriaText,
        instructions: question.instructions,
      },
      courseId
    );
    return { feedback };
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
}
