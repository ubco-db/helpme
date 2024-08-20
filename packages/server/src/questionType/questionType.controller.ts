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
  ParseIntPipe,
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QuestionTypeModel } from './question-type.entity';
import { Response } from 'express';
import { IsNull, getManager } from 'typeorm';
import { QueueModel } from '../queue/queue.entity';
import { ApplicationConfigService } from 'config/application_config.service';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { QuestionTypeService } from './questionType.service';

@Controller('questionType')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QuestionTypeController {
  constructor(
    private readonly appConfig: ApplicationConfigService,
    private questionTypeService: QuestionTypeService,
  ) {}
  @Post(':courseId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async addQuestionType(
    @Res() res: Response,
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() newQuestionType: QuestionTypeParams,
  ): Promise<void> {
    let queueId = newQuestionType.queueId;
    if (typeof queueId !== 'number' || isNaN(queueId)) {
      queueId = null;
    }

    const questionTypeCount = await QuestionTypeModel.count({
      where: {
        cid: courseId,
        queueId: queueId !== null ? queueId : IsNull(),
      },
    });
    if (
      questionTypeCount >= this.appConfig.get('max_question_types_per_queue')
    ) {
      res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Queue has reached maximum number of question types',
      });
      return;
    }

    try {
      const successMessage = await this.questionTypeService.addQuestionType(
        courseId,
        queueId,
        newQuestionType,
      );
      res.status(HttpStatus.OK).send(successMessage);
      return;
    } catch (e) {
      if (e.response && e.status) {
        res.status(e.status).send(e.response.message);
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(e.message);
      }
      return;
    }
  }

  // gets all question types for a queue. If queueId is not a number, it will return all async-question-centre question types for the course
  @Get(':courseId/:queueId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getQuestionTypes(
    @Res() res: Response,
    @Param('courseId', ParseIntPipe) courseId: number,
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
      take: this.appConfig.get('max_question_types_per_queue'),
    });
    if (questionTypes.length === 0) {
      res.status(HttpStatus.NOT_FOUND).send('No Question Types Found');
      return;
    }
    res.status(HttpStatus.OK).send(questionTypes);
  }

  // TODO: make it so that this "soft" deletes a questionType so that it can still be used for statistics using
  //@DeleteDateColumn in question-type.entity as well as using softDelete instead of delete. Custom queries on
  // questionType may need to have checks for this, but just using .find will already cover it. Use .withDeleted()
  // to also get the deleted question types for the insights page.
  @Delete(':courseId/:questionTypeId')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteQuestionType(
    @Res() res: Response,
    @Param('questionTypeId') questionTypeId: number,
    @Param('courseId') courseId: number,
  ): Promise<void> {
    const questionType = await QuestionTypeModel.findOne({
      where: {
        id: questionTypeId,
      },
    });
    if (!questionType) {
      res.status(HttpStatus.NOT_FOUND).send('Question Type not found');
      return;
    }
    try {
      await getManager().transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.delete(QuestionTypeModel, {
          id: questionTypeId,
          cid: courseId,
        });
        if (questionType.queueId) {
          // update the queue's config to remove the question type
          const queue = await transactionalEntityManager.findOne(
            QueueModel,
            questionType.queueId,
            {
              lock: { mode: 'pessimistic_write' }, // this is to stop other calls from modifying the queue while we're modifying it
            },
          );
          queue.config = queue.config || {}; // just in case it's null (It shouldn't be, but it might for old queues)
          queue.config.tags = queue.config.tags || {}; // just in case it's undefined
          // delete the tag that has the matching display_name as the deleted question type
          const idOfTagToBeDeleted = Object.keys(queue.config.tags).find(
            (key) => queue.config.tags[key].display_name === questionType.name,
          );
          if (idOfTagToBeDeleted) {
            delete queue.config.tags[idOfTagToBeDeleted];
          }
          await transactionalEntityManager.save(queue);
        }
      });
    } catch (e) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send(`Error deleting ${questionType.name}`);
      return;
    }
    res.status(HttpStatus.OK).send(`Successfully deleted ${questionType.name}`);
    return;
  }
}
