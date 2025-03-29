import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  GetQueueResponse,
  LimboQuestionStatus,
  ListQuestionsResponse,
  OpenQuestionStatus,
  QueueConfig,
  Role,
  UpdateQueueParams,
  isCycleInTasks,
  setQueueConfigResponse,
  validateQueueConfigInput,
} from '@koh/common';
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { UserId } from 'decorators/user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { QueueCleanService } from './queue-clean/queue-clean.service';
import { QueueRole } from '../decorators/queue-role.decorator';
import { QueueRolesGuard } from '../guards/queue-role.guard';
import { QueueSSEService } from './queue-sse.service';
import { QueueModel } from './queue.entity';
import { QueueService } from './queue.service';
import { QuestionModel } from '../question/question.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from '../redisQueue/redis-queue.service';

@Controller('queues')
@UseGuards(JwtAuthGuard, QueueRolesGuard, EmailVerifiedGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class QueueController {
  constructor(
    private queueSSEService: QueueSSEService,
    private queueCleanService: QueueCleanService,
    private queueService: QueueService, //note: this throws errors, be sure to catch them
    private redisQueueService: RedisQueueService,
  ) {}

  /*
  Gets all queue info.
  Note there is a method that is very similar to this in queue-invite.controller.ts
  Also, don't add any additional info to this endpoint (instead change the getQueue() service method).
  This is because there is a Server Side Event (SSE) listener that will call queueService.getQueue() and then send the data to the client over a websocket connection.
  If you add any additional info, the SSE listener will not have the same info as the client.
  */
  @Get(':queueId')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async getQueue(
    @Param('queueId', ParseIntPipe) queueId: number,
  ): Promise<GetQueueResponse> {
    try {
      return this.queueService.getQueue(queueId);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.getQueue,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /*
  Gets all questions in a queue and personalizes them.
  Note there is a method that is very similar to this in queue-invite.controller.ts.
  And note that just like getQueue(), this endpoint's functionality needs to be the same as updateQuestions inside queue-sse.service.ts
  */
  @Get(':queueId/questions')
  @Roles(Role.TA, Role.PROFESSOR, Role.STUDENT)
  async getQuestions(
    @Param('queueId') queueId: number,
    @QueueRole() role: Role,
    @UserId() userId: number,
  ): Promise<ListQuestionsResponse> {
    try {
      const queueKeys = await this.redisQueueService.getKey(`q:${queueId}`); // wait, this redis logic might not actually do anything since queue-sse service doesn't have it?
      let queueQuestions: any;

      if (Object.keys(queueKeys).length === 0) {
        console.log('Fetching queue questions from database');

        queueQuestions = await this.queueService.getQuestions(queueId);
        if (queueQuestions)
          await this.redisQueueService.setQuestions(
            `q:${queueId}`,
            queueQuestions,
          );
      } else {
        console.log('Fetching queue questions from Redis');
        queueQuestions = queueKeys.questions;
      }

      return await this.queueService.personalizeQuestions(
        queueId,
        queueQuestions,
        userId,
        role,
      );
    } catch (err) {
      console.log(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.getQuestions,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Patch(':queueId')
  @Roles(Role.TA, Role.PROFESSOR)
  async updateQueue(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() body: UpdateQueueParams,
  ): Promise<QueueModel> {
    const queue = await this.queueService.getQueue(queueId);
    if (queue === undefined) {
      throw new NotFoundException();
    }
    queue.type = body.type;
    queue.notes = body.notes;
    queue.allowQuestions = body.allowQuestions;
    queue.zoomLink = body.zoomLink;
    try {
      await queue.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.saveQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return queue;
  }

  @Post(':queueId/clean')
  @Roles(Role.TA, Role.PROFESSOR)
  async cleanQueue(
    @Param('queueId', ParseIntPipe) queueId: number,
  ): Promise<void> {
    // Clean up queue if necessary
    try {
      setTimeout(async () => {
        await this.queueCleanService.cleanQueue(queueId, true);
        await this.redisQueueService.deleteKey(`q:${queueId}`);
        await this.queueSSEService.updateQueue(queueId);
      });
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.cleanQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Endpoint to tell frontend when the queue changes
   * Note there is a similar method in queue-invite.controller.ts
   *  */
  @Get(':queueId/sse')
  sendEvent(
    @Param('queueId', ParseIntPipe) queueId: number,
    @QueueRole() role: Role,
    @UserId() userId: number,
    @Res() res: Response,
  ): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    try {
      this.queueSSEService.subscribeClient(queueId, res, { role, userId });
    } catch (err) {
      console.error(err);
    }
  }

  @Delete(':queueId')
  @Roles(Role.TA, Role.PROFESSOR)
  async disableQueue(
    @Param('queueId', ParseIntPipe) queueId: number,
    @QueueRole() role: Role,
  ): Promise<void> {
    // disable a queue
    const queue = await this.queueService.getQueue(queueId);
    if (!queue) {
      throw new NotFoundException();
    }

    if (queue.isProfessorQueue && role === Role.TA) {
      throw new HttpException(
        ERROR_MESSAGES.queueController.cannotCloseQueue,
        HttpStatus.UNAUTHORIZED,
      );
    }

    queue.isDisabled = true;

    // clear staff list
    queue.staffList = [];

    const questions = await QuestionModel.inQueueWithStatus(queueId, [
      ...Object.values(OpenQuestionStatus),
      ...Object.values(LimboQuestionStatus),
    ]).getMany();

    questions.forEach((q: QuestionModel) => {
      q.status = ClosedQuestionStatus.Stale;
      q.closedAt = new Date();
    });

    try {
      // try to save queue (and stale questions!)
      await QuestionModel.save(questions);
      await queue.save();
      await this.redisQueueService.deleteKey(`q:${queueId}`);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.saveQueue,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sets the JSON config for a queue and then returns success + any question tags that were created/deleted/updated
   */
  // note: for whatever reason, anytime you `return` a res.send(), you get "cannot set headers after they are sent" even though that's what you're supposed to do
  @Patch(':queueId/config')
  @Roles(Role.TA, Role.PROFESSOR)
  async setConfig(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() newConfig: QueueConfig,
    @Res() res: Response,
  ): Promise<Response<setQueueConfigResponse>> {
    // make sure queue config is valid
    const configError = validateQueueConfigInput(newConfig);
    if (configError) {
      res.status(HttpStatus.BAD_REQUEST).send({ message: configError });
      return;
    }

    // Make sure there are no cycles in the tasks of the config
    if (newConfig.tasks && isCycleInTasks(newConfig.tasks)) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: ERROR_MESSAGES.queueController.cycleInTasks });
      return;
    }

    try {
      const questionTypeMessages =
        await this.queueService.updateQueueConfigAndTags(queueId, newConfig);

      res.status(HttpStatus.OK).send({ questionTypeMessages });
      return;
    } catch (err) {
      console.error(err); // internal server error: figure out what went wrong
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: ERROR_MESSAGES.queueController.saveQueue });
      return;
    }
  }
}
