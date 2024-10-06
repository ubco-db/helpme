import {
  decodeBase64,
  ERROR_MESSAGES,
  GetQueueResponse,
  ListQuestionsResponse,
  PublicQueueInvite,
  QueueInviteParams,
  Role,
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
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { QueueRolesGuard } from '../guards/queue-role.guard';
import { QueueService } from './queue.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { QueueSSEService } from './queue-sse.service';

/**
 * This is a separate controller from queues because the GET endpoint for queue invite is public
 */
@Controller('queueInvites')
@UseInterceptors(ClassSerializerInterceptor)
export class QueueInviteController {
  constructor(
    private queueService: QueueService, //note: this throws errors, be sure to catch them
    private redisQueueService: RedisQueueService,
    private queueSSEService: QueueSSEService,
  ) {}

  /**
   * Creates a new queue invite for the given queue
   */
  @Post(':queueId')
  @UseGuards(JwtAuthGuard, QueueRolesGuard, EmailVerifiedGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async createQueueInvite(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Res() res: Response,
  ): Promise<Response<void>> {
    try {
      await this.queueService.createQueueInvite(queueId);
      res.status(HttpStatus.CREATED).send();
      return;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Deletes a queue invite for the given queue
   */
  @Delete(':queueId')
  @UseGuards(JwtAuthGuard, QueueRolesGuard, EmailVerifiedGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteQueueInvite(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Res() res: Response,
  ): Promise<Response<void>> {
    try {
      await this.queueService.deleteQueueInvite(queueId);
      res.status(HttpStatus.NO_CONTENT).send(); // NO_CONTENT is the correct status code for a successful DELETE request
      return;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Edits a queue invite for the given queue
   */
  @Patch(':queueId')
  @UseGuards(JwtAuthGuard, QueueRolesGuard, EmailVerifiedGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async editQueueInvite(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body() body: QueueInviteParams,
    @Res() res: Response,
  ): Promise<Response<void>> {
    1;
    try {
      await this.queueService.editQueueInvite(queueId, body);
      res.status(HttpStatus.OK).send();
      return;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Gets the queue invite for the given queue. This is a public endpoint.
   * Accepts a parameter `inviteCode` which is the invite code for the queue.
   * If isQuestionsVisible is true, the questions will be added.
   * If willInviteToCourse is true, the course's invite code will be returned as well.
   */
  @Get(':queueId/:inviteCode')
  async getQueueInvite(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('inviteCode') inviteCode: string,
    @Res() res: Response,
  ): Promise<Response<PublicQueueInvite>> {
    const decodedInviteCode = decodeBase64(inviteCode);
    try {
      const invite = await this.queueService.getQueueInvite(
        queueId,
        decodedInviteCode,
      );
      res.status(HttpStatus.OK).send(invite);
      return;
    } catch (err) {
      throw err;
    }
  }

  /*
Works functionally the same as getQueue in queue.controller.ts but is publicly accessible if they have the correct queue invite code
*/
  @Get(':queueId/:queueInviteCode/queue')
  async getQueueWithQueueInviteCode(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('queueInviteCode') queueInviteCode: string,
  ): Promise<GetQueueResponse> {
    if (!queueInviteCode) {
      throw new NotFoundException();
    }
    const shouldQuestionsBeShown =
      await this.queueService.verifyQueueInviteCodeAndCheckIfQuestionsVisible(
        queueId,
        queueInviteCode,
      );
    if (!shouldQuestionsBeShown) {
      throw new NotFoundException();
    }
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
Works functionally the same as getQuestions in queue.controller.ts but is publicly accessible if they have the correct queue invite code
*/
  @Get(':queueId/:queueInviteCode/questions')
  async getQuestions(
    @Param('queueId') queueId: number,
    @Param('queueInviteCode') queueInviteCode: string,
  ): Promise<ListQuestionsResponse> {
    if (!queueInviteCode) {
      throw new NotFoundException();
    }
    const shouldQuestionsBeShown =
      await this.queueService.verifyQueueInviteCodeAndCheckIfQuestionsVisible(
        queueId,
        queueInviteCode,
      );
    if (!shouldQuestionsBeShown) {
      throw new NotFoundException();
    }
    try {
      const queueKeys = await this.redisQueueService.getKey(`q:${queueId}`);
      let queueQuestions: any;

      if (Object.keys(queueKeys).length === 0) {
        console.log('Fetching from database');

        queueQuestions = await this.queueService.getQuestions(queueId);
        if (queueQuestions)
          await this.redisQueueService.setQuestions(
            `q:${queueId}`,
            queueQuestions,
          );
      } else {
        console.log('Fetching from Redis');
        queueQuestions = queueKeys.questions;
      }

      // I choose Role.STUDENT to remove sensitive data, and no user has a userId of 0
      const personalizedQuestions =
        await this.queueService.personalizeQuestions(
          queueId,
          queueQuestions,
          0,
          Role.STUDENT,
        );
      return personalizedQuestions;
    } catch (err) {
      console.log(err);
      throw new HttpException(
        ERROR_MESSAGES.queueController.getQuestions,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * Note this works functionally the same as the one in queue.controller.ts
   */
  @Get(':queueId/:queueInviteCode/sse')
  async sendEvent(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('queueInviteCode') queueInviteCode: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!queueInviteCode) {
      throw new NotFoundException();
    }
    const shouldQuestionsBeShown =
      await this.queueService.verifyQueueInviteCodeAndCheckIfQuestionsVisible(
        queueId,
        queueInviteCode,
      );
    if (!shouldQuestionsBeShown) {
      throw new NotFoundException();
    }
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    try {
      // I choose Role.STUDENT to remove sensitive data, and no user has a userId of 0
      this.queueSSEService.subscribeClient(queueId, res, {
        role: Role.STUDENT,
        userId: 0,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
