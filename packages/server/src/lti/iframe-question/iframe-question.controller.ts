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
  CreateIFrameQuestionParams,
  IFrameQuestionFeedbackParams,
  IFrameQuestionFeedbackResponse,
  Role,
  UpdateIFrameQuestionParams,
} from '@koh/common';
import { IFrameQuestionService } from './iframe-question.service';
import { ChatbotApiService } from '../../chatbot/chatbot-api.service';
import { IFrameQuestionModel } from './iframe-question.entity'

@Controller('lti/iframe-question')
@UseInterceptors(ClassSerializerInterceptor)
export class IFrameQuestionController {
  constructor(
    private iframeQuestionService: IFrameQuestionService,
    private chatbotApiService: ChatbotApiService,
  ) {}

  // prof/TA lists all questions for a course
  @Get(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(@Param('courseId', ParseIntPipe) courseId: number): Promise<IFrameQuestionModel[]> {
    return await this.iframeQuestionService.findAllForCourse(courseId);
  }

  // anyone in the course can get a single question (authenticated)
  @Get(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<IFrameQuestionModel> {
    return await this.iframeQuestionService.findOne(courseId, questionId);
  }

  // public feedback endpoint for embedded iframe usage (no login required)
  @Post(':courseId/:questionId/feedback')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getFeedback(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: IFrameQuestionFeedbackParams,
  ): Promise<IFrameQuestionFeedbackResponse> {
    const responseText = body.responseText?.trim();
    if (!responseText) {
      throw new BadRequestException('Input is required');
    }

    const question = await this.iframeQuestionService.findOne(
      courseId,
      questionId,
    );
    let query = `Question: ${question.questionText}\n\n`;
    if (question.criteriaText?.trim()) {
      query += `Criteria: ${question.criteriaText.trim()}\n\n`;
    }
    query += `Student's response: ${responseText}`;

    const feedback = await this.chatbotApiService.queryChatbot(
      query,
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

  // prof/TA creates a new question
  @Post(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: CreateIFrameQuestionParams,
  ): Promise<IFrameQuestionModel> {
    return await this.iframeQuestionService.upsert(
      courseId,
      body,
    );
  }

  // prof/TA updates a question
  @Patch(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateIFrameQuestionParams,
  ): Promise<IFrameQuestionModel>  {
    return await this.iframeQuestionService.upsert(
      courseId,
      body,
      questionId,
    );
  }

  // prof/TA deletes a question
  @Delete(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ): Promise<void> {
    await this.iframeQuestionService.delete(questionId);
  }
}
