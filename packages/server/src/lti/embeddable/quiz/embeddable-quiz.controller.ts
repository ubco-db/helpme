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
import { Role, UpsertEmbeddableQuizParams } from '@koh/common';
import { CourseRolesGuard } from '../../../guards/course-roles.guard';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { EmbeddableQuizModel } from './embeddable-quiz.entity';
import { EmbeddableQuizService } from './embeddable-quiz.service';

@Controller('lti/embeddable-quiz')
@UseGuards(JwtAuthGuard, CourseRolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class EmbeddableQuizController {
  constructor(private readonly quizService: EmbeddableQuizService) {}

  @Get(':courseId')
  @Roles(Role.TA, Role.PROFESSOR)
  async findAll(
    @Param('courseId', ParseIntPipe) courseId: number,
  ): Promise<EmbeddableQuizModel[]> {
    return this.quizService.findAllForCourse(courseId);
  }

  @Get(':courseId/:quizId')
  @Roles(Role.TA, Role.PROFESSOR)
  async findOne(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
  ): Promise<EmbeddableQuizModel> {
    return this.quizService.findOne(courseId, quizId);
  }

  @Post(':courseId')
  @Roles(Role.TA, Role.PROFESSOR)
  async create(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: UpsertEmbeddableQuizParams,
  ): Promise<EmbeddableQuizModel> {
    return this.quizService.upsert(courseId, body);
  }

  @Patch(':courseId/:quizId')
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() body: UpsertEmbeddableQuizParams,
  ): Promise<EmbeddableQuizModel> {
    return this.quizService.upsert(courseId, body, quizId);
  }

  @Delete(':courseId/:quizId')
  @Roles(Role.TA, Role.PROFESSOR)
  async delete(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
  ): Promise<void> {
    return this.quizService.delete(courseId, quizId);
  }
}
