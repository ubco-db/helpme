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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { Roles } from '../decorators/roles.decorator';
import {
  CreateIframeQuestionParams,
  IframeQuestionFeedbackParams,
  IframeQuestionFeedbackResponse,
  Role,
  UpdateIframeQuestionParams,
} from '@koh/common';
import { IframeQuestionService } from './iframe-question.service';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { minutes, Throttle } from '@nestjs/throttler';

@Controller('iframe-question')
@UseInterceptors(ClassSerializerInterceptor)
export class IframeQuestionController {
  constructor(
    private iframeQuestionService: IframeQuestionService,
    private chatbotApiService: ChatbotApiService,
  ) {}

  // prof/TA creates a new question
  @Post(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: CreateIframeQuestionParams,
  ) {
    return await this.iframeQuestionService.create(
      courseId,
      body.questionText,
      body.criteriaText,
    );
  }

  // prof/TA lists all questions for a course
  @Get(':courseId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.iframeQuestionService.findAllForCourse(courseId);
  }

  // anyone in the course can get a single question (authenticated)
  @Get(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return await this.iframeQuestionService.findOne(courseId, questionId);
  }

  // public read endpoint for embedded iframe usage (no login required)
  @Get('public/:courseId/:questionId')
  async findOnePublic(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return await this.iframeQuestionService.findOne(courseId, questionId);
  }

  // public feedback endpoint for embedded iframe usage (no login required)
  @Throttle({ default: { limit: 10, ttl: minutes(5) } })
  @Post('public/:courseId/:questionId/feedback')
  async getFeedbackPublic(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: IframeQuestionFeedbackParams,
  ): Promise<IframeQuestionFeedbackResponse> {
    const responseText = body.responseText?.trim();
    if (!responseText) {
      throw new BadRequestException('responseText is required');
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
      'default',
    );
    return { feedback };
  }

  // prof/TA updates a question
  @Patch(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: UpdateIframeQuestionParams,
  ) {
    return await this.iframeQuestionService.update(
      courseId,
      questionId,
      body.questionText,
      body.criteriaText,
    );
  }

  // prof/TA deletes a question
  @Delete(':courseId/:questionId')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    await this.iframeQuestionService.delete(courseId, questionId);
    return { message: 'Question deleted' };
  }
}
