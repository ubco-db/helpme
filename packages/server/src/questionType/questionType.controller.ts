import { Role, QuestionTypeParams } from '@koh/common';
import {
  Controller,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  Body,
  Delete,
  Get,
  Param,
  Post,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QuestionTypeModel } from './question-type.entity';
import { Response } from 'express';
import { CourseModel } from 'course/course.entity';

@Controller('questionType')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QuestionTypeController {
  readonly MAX_QUESTION_TYPES_PER_QUEUE = 20;

  @Post(':c')
  @Roles(Role.TA, Role.PROFESSOR)
  async addQuestionType(
    @Res() res: Response,
    @Param('c') courseId: number,
    @Body() newQuestionType: QuestionTypeParams,
  ): Promise<void> {
    const course = await CourseModel.findOne({
      where: {
        id: courseId,
      },
      relations: ['queues'],
    });

    if (!course) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Course does not exist' });
      return;
    }

    if (course?.queues.length === 0) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Course does not have any queues' });
      return;
    }

    const queue = course.queues.find(
      (queue) => queue.id === newQuestionType.queueId,
    );

    if (!queue) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Queue does not exist' });
      return;
    }

    const questionTypeCount = await QuestionTypeModel.count({
      where: {
        cid: courseId,
        queueId: newQuestionType.queueId,
      },
    });

    if (questionTypeCount >= this.MAX_QUESTION_TYPES_PER_QUEUE) {
      res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Queue has reached maximum number of question types',
      });
      return;
    }

    const questionType = await QuestionTypeModel.findOne({
      where: {
        cid: courseId,
        queueId: newQuestionType.queueId,
        name: newQuestionType.name,
      },
    });
    if (!questionType) {
      await QuestionTypeModel.create({
        cid: courseId,
        name: newQuestionType.name,
        color: newQuestionType.color,
        queueId: newQuestionType.queueId,
      }).save();
      res.status(HttpStatus.OK).send('success');
      return;
    } else {
      res.status(HttpStatus.BAD_REQUEST).send('Question already exists');
      return;
    }
  }

  @Get(':c/:queueId')
  async getQuestionTypes(
    @Res() res: Response,
    @Param('c') course: number,
    @Param('queueId') queueId: number | null,
  ): Promise<QuestionTypeModel[]> {
    if (typeof queueId !== 'number' || isNaN(queueId)) {
      queueId = null;
    }

    const questions = await QuestionTypeModel.find({
      where: {
        cid: course,
        queueId,
      },
      take: this.MAX_QUESTION_TYPES_PER_QUEUE,
    });

    if (!questions) {
      res.status(400).send('None');
      return;
    }
    res.status(200).send(questions);
  }

  @Delete(':c/:questionTypeId')
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteQuestionType(
    @Res() res: Response,
    @Param('questionTypeId') questionTypeId: number,
    @Param('c') courseId: number,
  ): Promise<void> {
    await QuestionTypeModel.delete({
      id: questionTypeId,
      cid: courseId,
    });
    res.status(200).send('success');
    return;
  }
}
