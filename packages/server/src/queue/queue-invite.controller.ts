import { PublicQueueInvite, QueueInviteParams, Role } from '@koh/common';
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpStatus,
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

/**
 * This is a separate controller from queues because the GET endpoint for queue invite is public
 */
@Controller('queueInvites')
@UseInterceptors(ClassSerializerInterceptor)
export class QueueInviteController {
  constructor(
    private queueService: QueueService, //note: this throws errors, be sure to catch them
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
    try {
      const invite = await this.queueService.getQueueInvite(
        queueId,
        inviteCode,
      );
      res.status(HttpStatus.OK).send(invite);
      return;
    } catch (err) {
      throw err;
    }
  }
}