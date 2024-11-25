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
import { User, UserId } from 'decorators/user.decorator';
import { UserModel } from 'profile/user.entity';
import { QueueSSEService } from 'queue/queue-sse.service';
import { Response } from 'express-serve-static-core';
import { QueueRole } from 'decorators/queue-role.decorator';
import { Role } from '@koh/common';
import { QueueChatSSEService } from './queue-chats-sse.service';

@Controller('queueChats')
@UseGuards(JwtAuthGuard)
export class QueueChatController {
  constructor(
    private queueChatService: QueueChatService,
    private queueChatSSEService: QueueChatSSEService,
  ) {}

  // PAT TODO: put error messages in ERROR_MESSAGES

  @Get(':queueId/:studentId')
  @UseGuards(JwtAuthGuard)
  async getQueueChat(
    @Param('queueId') queueId: number,
    @Param('studentId') studentId: number,
    @User() user: UserModel,
  ) {
    const chatData = await this.queueChatService.getChatData(
      queueId,
      studentId,
    );
    if (!chatData) {
      throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
    }

    await this.queueChatService
      .checkPermissions(queueId, studentId, user.id)
      .then((allowedToRetrieve) => {
        if (!allowedToRetrieve) {
          throw new HttpException(
            'User is not allowed to retrieve chat data at this time',
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
  @Get(':queueId/:studentId/sse')
  sendEvent(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('studentId', ParseIntPipe) studentId: number,
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
      this.queueChatSSEService.subscribeClient(queueId, studentId, res, {
        role,
        userId,
      });
    } catch (err) {
      console.error(err);
    }
  }

  @Patch(':queueId/:studentId')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('queueId') queueId: number,
    @Param('studentId') studentId: number,
    @User() user: UserModel,
    @Body('message') message: string,
  ) {
    const metadata = await this.queueChatService.getChatMetadata(
      queueId,
      studentId,
    );
    if (!metadata) {
      throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
    }

    const allowedToSend = await this.queueChatService.checkPermissions(
      queueId,
      studentId,
      user.id,
    );
    if (!allowedToSend) {
      throw new HttpException(
        'User is not allowed to send message',
        HttpStatus.FORBIDDEN,
      );
    }
    try {
      const isStaff = user.id === metadata.staff.id;
      await this.queueChatService.sendMessage(
        queueId,
        studentId,
        isStaff,
        message,
      );
      await this.queueChatSSEService.updateQueueChat(queueId, studentId);
      return { message: 'Message sent' };
    } catch (error) {
      if (error) {
        console.error(error);
        throw new HttpException(
          'Error sending queue chat message',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}
