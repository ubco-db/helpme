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
import { Role, upsertEmbeddableQuizSchema } from '@koh/common';
import { CourseRolesGuard } from '../../../guards/course-roles.guard';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { EmbeddableQuizModel } from './embeddable-quiz.entity';
import { EmbeddableQuizService } from './embeddable-quiz.service';

function parseBody<T>(
  schema: { parse(value: unknown): T },
  body: unknown,
  message: string,
): T {
  try {
    return schema.parse(body);
  } catch {
    throw new BadRequestException(message);
  }
}

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
    @Body() body: unknown,
  ): Promise<EmbeddableQuizModel> {
    return this.quizService.upsert(
      courseId,
      parseBody(
        upsertEmbeddableQuizSchema,
        body,
        'Invalid embeddable quiz configuration.',
      ),
    );
  }

  @Patch(':courseId/:quizId')
  @Roles(Role.TA, Role.PROFESSOR)
  async update(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
    @Body() body: unknown,
  ): Promise<EmbeddableQuizModel> {
    return this.quizService.upsert(
      courseId,
      parseBody(
        upsertEmbeddableQuizSchema,
        body,
        'Invalid embeddable quiz configuration.',
      ),
      quizId,
    );
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
