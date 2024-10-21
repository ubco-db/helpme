import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { QueueChatService } from './queue-chats.service';
import { QueueModel } from 'queue/queue.entity';
import { QueueService } from 'queue/queue.service';
import { OpenQuestionStatus } from '@koh/common';
import { User } from 'decorators/user.decorator';
import { UserModel } from 'profile/user.entity';

@Controller('queue-chats')
@UseGuards(JwtAuthGuard)
export class QueueChatController {
  constructor(private queueChatService: QueueChatService) {}

  @Get(':courseId/:queueId')
  async getQueueChat(
    @Param('queueId') queueId: number,
    @Param('courseId') courseId: number,
  ) {
    return this.queueChatService.getChatMessages(courseId, queueId);
  }

  @Put(':courseId/:queueId')
  @UseGuards(JwtAuthGuard)
  async createChat(
    @Param('queueId') queueId: number,
    @Param('courseId') courseId: number,
    @User() user: UserModel,
  ) {
    const queue = await QueueModel.findOne(queueId, {
      relations: ['questions'],
    });
    if (!queue) {
      throw new HttpException('Queue not found', HttpStatus.NOT_FOUND);
    }
    const helpedQuestion = queue.questions.find(
      (question) => question.status === OpenQuestionStatus.Helping,
    );

    if (
      user.id !== helpedQuestion.taHelpedId &&
      user.id !== helpedQuestion.creatorId
    ) {
      throw new HttpException(
        'User is not allowed to create chat',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.queueChatService.createChat(
      courseId,
      queueId,
      helpedQuestion.taHelpedId,
      helpedQuestion.creatorId,
    );
  }
}
