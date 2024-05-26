import {
  Role,
  StudentTaskProgressRequest,
  StudentTaskProgressResponse,
} from '@koh/common';
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
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Connection } from 'typeorm';
import { StudentTaskProgress } from './studentTaskProgress.entity';
import { Response } from 'express';

@Controller('studentTaskProgress')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StudentTaskProgressController {
  constructor(private connection: Connection) {}

  // takes in 3 inputs (queueId, userId, and sessionName) and returns the student's task progress as a JSON
  // TODO: prevent students from being able to see other students' task progress while still allowing TAs and professors to see all students' task progress
  @Post('studentTaskProgress/:qid/:uid')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async setStudentTaskProgress(
    @Res() res: Response,
    @Param('qid') queueId: number,
    @Param('uid') userId: number,
    @Body('sessionName') sessionName: string,
  ): Promise<void> {
    let queueId = newQuestionType.queueId;
    if (typeof queueId !== 'number' || isNaN(queueId)) {
      queueId = null;
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
      res.status(200).send('success');
      return;
    } else {
      res.status(400).send('Question already exists');
      return;
    }
  }

  @Get('studentTaskProgress/:qid/:uid')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async getStudentTaskProgress(
    @Res() res: Response,
    @Param('qid') queueId: number,
    @Param('uid') userId: number,
    @Body('sessionName') sessionName: string,
  ): Promise<void> {
    if (typeof queueId !== 'number' || isNaN(queueId)) {
      queueId = null;
    }

    const questions = await QuestionTypeModel.find({
      where: {
        cid: course,
        queueId,
      },
    });
    if (!questions) {
      res.status(400).send('None');
      return;
    }
    res.status(200).send(questions);
  }
}
