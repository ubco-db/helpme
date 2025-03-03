import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QueueChatService } from './queue-chats.service';
import { UserId } from 'decorators/user.decorator';
import { Response } from 'express-serve-static-core';
import { QueueRole } from 'decorators/queue-role.decorator';
import { ERROR_MESSAGES, Role } from '@koh/common';
import { QueueChatSSEService } from './queue-chats-sse.service';

/* Note that these endpoints are special in that they don't have any Roles guards.
  Instead, these endpoints use .checkPermissions() which only allows the chat's TA and student to call these endpoints.
*/
@Controller('queueChats')
@UseGuards(JwtAuthGuard)
export class QueueChatController {
  constructor(
    private queueChatService: QueueChatService,
    private queueChatSSEService: QueueChatSSEService,
  ) {}

  @Get(':queueId/:questionId')
  async getQueueChat(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @UserId() userId: number,
  ) {
    const chatData = await this.queueChatService.getChatData(
      queueId,
      questionId,
    );
    if (!chatData) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.chatNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.queueChatService
      .checkPermissions(queueId, questionId, userId)
      .then((allowedToRetrieve) => {
        if (!allowedToRetrieve) {
          throw new HttpException(
            ERROR_MESSAGES.queueChatsController.chatNotAuthorized,
            HttpStatus.FORBIDDEN,
          );
        }
      });

    return chatData;
  }

  /**
   * Endpoint to tell frontend when the queue chat changes
   * Note there is a similar method in queue-invite.controller.ts & queue.controller.ts
   *  */
  @Get(':queueId/:questionId/sse')
  sendEvent(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
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
      this.queueChatSSEService.subscribeClient(queueId, questionId, res, {
        role,
        userId,
      });
    } catch (err) {
      console.error(err);
    }
  }

  @Patch(':queueId/:questionId')
  async sendMessage(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @UserId() userId: number,
    @Body('message') message: string,
  ) {
    const metadata = await this.queueChatService.getChatMetadata(
      queueId,
      questionId,
    );
    if (!metadata) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.chatNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const allowedToSend = await this.queueChatService.checkPermissions(
      queueId,
      questionId,
      userId,
    );
    if (!allowedToSend) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.sendNotAuthorized,
        HttpStatus.FORBIDDEN,
      );
    }
    try {
      const isStaff = userId === metadata.staff.id;
      await this.queueChatService.sendMessage(
        queueId,
        questionId,
        isStaff,
        message,
      );
      await this.queueChatSSEService.updateQueueChat(queueId, questionId);
      return { message: 'Message sent' };
    } catch (error) {
      if (error) {
        console.error(error);
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.internalSendError,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}
