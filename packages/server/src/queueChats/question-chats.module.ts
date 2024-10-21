import { Module } from '@nestjs/common';
import { QueueChatController } from './queue-chats.controller';
import { QueueChatService } from './queue-chats.service';

@Module({
  controllers: [QueueChatController],
  providers: [QueueChatService],
})
export class QuestionTypeModule {}
