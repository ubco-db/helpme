import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QueueChatService } from './queue-chats.service';
import { User, UserId } from 'decorators/user.decorator';
import { Response } from 'express-serve-static-core';
import { QueueRole } from 'decorators/queue-role.decorator';
import { ERROR_MESSAGES, QueueChatPartial, Role } from '@koh/common';
import { QueueChatSSEService } from './queue-chats-sse.service';
import { UserModel } from 'profile/user.entity';
import { QueueModel } from 'queue/queue.entity';
import { QuestionModel } from 'question/question.entity';
import { In } from 'typeorm';
import { QueueRolesGuard } from 'guards/queue-role.guard';
import { Roles } from 'decorators/roles.decorator';
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

  // note that this isn't the only way queue chats are created. They are also created automatically when a student is helped
  @Post(':queueId/:questionId/:staffId')
  @UseGuards(QueueRolesGuard) // checks to make sure the user is in the course of the given queueId
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async startQueueChat(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @Param('staffId') staffId: number,
    @User(['courses']) user: UserModel,
  ) {
    if (
      await this.queueChatService.checkChatExists(queueId, questionId, staffId)
    ) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.chatAlreadyExists,
        HttpStatus.BAD_REQUEST,
      );
    }
    const queue = await QueueModel.findOne({ where: { id: queueId } });
    if (!queue) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.queueNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const courseId = queue.courseId;

    const question = await QuestionModel.findOne({
      where: { id: questionId, queueId },
    });
    if (!question) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.questionNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const myRole = user.courses.find((c) => c.courseId === courseId)?.role;

    // students can only create chats for questions they created
    if (
      myRole !== Role.PROFESSOR &&
      myRole !== Role.TA &&
      question.creatorId !== user.id
    ) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.questionNotAuthorized,
        HttpStatus.FORBIDDEN,
      );
    }

    const staff = await UserModel.findOne({
      relations: {
        courses: true,
      },
      where: {
        id: staffId,
        courses: {
          courseId,
          role: In([Role.TA, Role.PROFESSOR]),
        },
      },
    });
    if (!staff) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.staffNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    await this.queueChatService.createChat(queueId, staff, question);
    return { message: 'Chat started' };
  }

  @Get(':queueId/:questionId/:staffId')
  async getQueueChat(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @Param('staffId') staffId: number,
    @UserId() userId: number,
  ): Promise<QueueChatPartial> {
    const chatData = await this.queueChatService.getChatData(
      queueId,
      questionId,
      staffId,
    );
    if (!chatData) {
      throw new HttpException(
        ERROR_MESSAGES.queueChatsController.chatNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.queueChatService
      .checkPermissions(queueId, questionId, staffId, userId)
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

  /* used by students to get all the chats they have for their question */
  @Get(':queueId/:questionId')
  @UseGuards(QueueRolesGuard)
  @Roles(Role.STUDENT)
  async getQueueChatsForMyQuestion(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @UserId() userId: number,
  ): Promise<QueueChatPartial[]> {
    const chats = await this.queueChatService.getChatsForMyQuestion(
      queueId,
      questionId,
      userId,
    );
    return chats;
  }

  /* Used by staff to get all the chats they have for a given queue */
  @Get(':queueId')
  @UseGuards(QueueRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getMyQueueChatsForGivenQueue(
    @Param('queueId') queueId: number,
    @UserId() userId: number,
  ): Promise<QueueChatPartial[]> {
    const chats = await this.queueChatService.getChatsForGivenStaffId(
      queueId,
      userId,
    );
    return chats;
  }

  /**
   * Endpoint to tell frontend when the queue chat changes
   * Note there is a similar method in queue-invite.controller.ts & queue.controller.ts
   *  */
  @Get(':queueId/:questionId/:staffId/sse')
  sendEvent(
    @Param('queueId', ParseIntPipe) queueId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
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
      this.queueChatSSEService.subscribeClient(
        queueId,
        questionId,
        staffId,
        res,
        {
          role,
          userId,
        },
      );
    } catch (err) {
      console.error(err);
    }
  }

  @Patch(':queueId/:questionId/:staffId')
  async sendMessage(
    @Param('queueId') queueId: number,
    @Param('questionId') questionId: number,
    @Param('staffId') staffId: number,
    @UserId() userId: number,
    @Body('message') message: string,
  ) {
    const metadata = await this.queueChatService.getChatMetadata(
      queueId,
      questionId,
      staffId,
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
      staffId,
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
        staffId,
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
