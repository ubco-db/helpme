import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QueueChatService } from './queue-chats.service';
import { User } from 'decorators/user.decorator';
import { UserModel } from 'profile/user.entity';
import { QueueSSEService } from 'queue/queue-sse.service';

@Controller('queueChats')
@UseGuards(JwtAuthGuard)
export class QueueChatController {
  constructor(
    private queueChatService: QueueChatService,
    private queueSSEService: QueueSSEService,
  ) {}

  // PAT TODO: put error messages in ERROR_MESSAGES
  // PAT TODO: consider more than one student being helped
  // PAT TODO: remove unused functions

  @Get(':queueId')
  @UseGuards(JwtAuthGuard)
  async getQueueChat(
    @Param('queueId') queueId: number,
    @User() user: UserModel,
  ) {
    try {
      return this.queueChatService.getChatData(queueId).then((chatData) => {
        if (!chatData) {
          throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
        }

        this.queueChatService
          .checkPermissions(queueId, user.id)
          .then((allowedToRetrieve) => {
            if (!allowedToRetrieve) {
              throw new HttpException(
                'User is not allowed to view chat',
                HttpStatus.FORBIDDEN,
              );
            }
          });

        return chatData;
      });
    } catch (error) {
      if (error) {
        console.error(error);
        throw new HttpException(
          'Error getting chat',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  // @Put(':queueId')
  // @UseGuards(JwtAuthGuard)
  // async createChat(
  //   @Param('queueId') queueId: number,
  //   @User() user: UserModel,
  // ) {
  //   try {
  //     const queue = await QueueModel.findOne(queueId, {
  //       relations: ['questions'],
  //     });
  //     if (!queue) {
  //       throw new HttpException('Queue not found', HttpStatus.NOT_FOUND);
  //     }
  //     const helpedQuestion = queue.questions.find(
  //       (question) => question.status === OpenQuestionStatus.Helping,
  //     );

  //     this.queueChatService.checkPermissions(queueId, user.id).then((allowedToCreate) => {
  //       if (!allowedToCreate) {
  //         throw new HttpException(
  //           'User is not allowed to create chat',
  //           HttpStatus.FORBIDDEN,
  //         );
  //       }
  //     });

  //     // Create a chat in Redis and return status 200 if successful
  //     return this.queueChatService.createChat(
  //       queueId,
  //       helpedQuestion.taHelpedId,
  //       helpedQuestion.creatorId,
  //     );

  //   } catch (error) {
  //     if (error) {
  //       console.error(error);
  //       throw new HttpException('Error creating chat', HttpStatus.INTERNAL_SERVER_ERROR);
  //     }
  //   }
  // }

  @Patch(':queueId')
  @UseGuards(JwtAuthGuard)
  async sendMessage(
    @Param('queueId') queueId: number,
    @User() user: UserModel,
    @Body('message') message: string,
  ) {
    try {
      this.queueChatService
        .checkChatExists(queueId)
        .then(async (chatExists) => {
          if (!chatExists) {
            throw new HttpException(
              'Chat does not exist',
              HttpStatus.NOT_FOUND,
            );
          }

          this.queueChatService
            .checkPermissions(queueId, user.id)
            .then((allowedToSend) => {
              if (!allowedToSend) {
                throw new HttpException(
                  'User is not allowed to send message',
                  HttpStatus.FORBIDDEN,
                );
              }
            });

          const metadata = await this.queueChatService.getChatMetadata(queueId);
          const isStaff = user.id === metadata.staff.id;
          return this.queueChatService
            .sendMessage(queueId, isStaff, message)
            .then(() => {
              this.queueSSEService.updateQueueChat(queueId);
            });
        });
    } catch (error) {
      if (error) {
        console.error(error);
        throw new HttpException(
          'Error sending message',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  // @Delete(':courseId/:queueId')
  // @UseGuards(JwtAuthGuard)
  // async deleteChat(
  //   @Param('queueId') queueId: number,
  //   @Param('courseId') courseId: number,
  //   @User() user: UserModel,
  // ) {
  //   try {
  //     this.queueChatService.checkPermissions(courseId, queueId, user.id).then((allowedToDelete) => {
  //       if (!allowedToDelete) {
  //         throw new HttpException('User is not allowed to delete chat', HttpStatus.FORBIDDEN);
  //       }
  //     });

  //     // Delete chat from Redis and return status 200 if successful
  //     return this.queueChatService.endChat(courseId, queueId);
  //   } catch (error) {
  //     if (error) {
  //       console.error(error);
  //       throw new HttpException('Error deleting chat', HttpStatus.INTERNAL_SERVER_ERROR);
  //     }
  //   }
  // }
}
