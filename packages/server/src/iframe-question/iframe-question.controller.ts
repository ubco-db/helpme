import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@koh/common';
import { IframeQuestionService } from './iframe-question.service';

@Controller('iframe-question')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class IframeQuestionController {
  constructor(private iframeQuestionService: IframeQuestionService) {}

  // prof/TA creates a new question
  @Post(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { questionText: string; criteriaText?: string },
  ) {
    return await this.iframeQuestionService.create(
      courseId,
      body.questionText,
      body.criteriaText,
    );
  }

  // prof/TA lists all questions for a course
  @Get(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(@Param('courseId', ParseIntPipe) courseId: number) {
    return await this.iframeQuestionService.findAllForCourse(courseId);
  }

  // anyone in the course can get a single question (students need this for the iframe)
  @Get(':courseId/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    return await this.iframeQuestionService.findOne(courseId, questionId);
  }

  // prof/TA updates a question
  @Patch(':courseId/:questionId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: { questionText?: string; criteriaText?: string },
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
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
  ) {
    await this.iframeQuestionService.delete(courseId, questionId);
    return { message: 'Question deleted' };
  }
}
