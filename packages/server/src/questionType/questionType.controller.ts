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
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Connection } from 'typeorm';
import { QuestionTypeModel } from './question-type.entity';
import { Response } from 'express';

@Controller('questionType')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QuestionTypeController {
  constructor(private connection: Connection) {}

  @Post(':c')
  @Roles(Role.TA, Role.PROFESSOR)
  async addQuestionType(
    @Res() res: Response,
    @Param('c') courseId: number,
    @Body() newQuestionType: QuestionTypeParams,
  ): Promise<void> {
    console.log('newQuestionType', newQuestionType);
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
