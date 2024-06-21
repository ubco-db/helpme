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
import { QuestionTypeModel } from './question-type.entity';
import { Response } from 'express';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { IsNull } from 'typeorm';

@Controller('questionType')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QuestionTypeController {
  @Post(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async addQuestionType(
    @Res() res: Response,
    @Param('courseId') courseId: number,
    @Body() newQuestionType: QuestionTypeParams,
  ): Promise<void> {
    let queueId = newQuestionType.queueId;
    if (typeof queueId !== 'number' || isNaN(queueId)) {
      queueId = null;
    }
    const questionType = await QuestionTypeModel.findOne({
      where: {
        cid: courseId,
        queueId: queueId,
        name: newQuestionType.name,
      },
    });
    if (!questionType) {
      try {
        await QuestionTypeModel.create({
          cid: courseId,
          name: newQuestionType.name,
          color: newQuestionType.color,
          queueId: queueId,
        }).save();
        res.status(200).send('success');
        return;
      } catch (e) {
        res.status(400).send('Error creating question type');
        return;
      }
    } else {
      res.status(400).send('Question type already exists');
      return;
    }
  }

  // gets all question types for a queue. If queueId is not a number, it will return all async-question-centre question types for the course
  @Get(':courseId/:queueId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getQuestionTypes(
    @Res() res: Response,
    @Param('courseId') courseId: number,
    @Param('queueId') queueIdString: string,
  ): Promise<QuestionTypeModel[]> {
    let queueId: null | number = null;
    queueId = Number(queueIdString);
    if (isNaN(queueId)) {
      queueId = null;
    }

    const questionTypes = await QuestionTypeModel.find({
      where: {
        cid: courseId,
        queueId: queueId !== null ? queueId : IsNull(),
      },
    });
    if (questionTypes.length === 0) {
      res.status(404).send('No Question Types Found');
      return;
    }
    res.status(200).send(questionTypes);
  }

  // TODO: make it so that this "soft" deletes a questionType so that it can still be used for statistics
  @Delete(':courseId/:questionTypeId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteQuestionType(
    @Res() res: Response,
    @Param('questionTypeId') questionTypeId: number,
    @Param('courseId') courseId: number,
  ): Promise<void> {
    await QuestionTypeModel.delete({
      id: questionTypeId,
      cid: courseId,
    });
    res.status(200).send('success');
    return;
  }
}
