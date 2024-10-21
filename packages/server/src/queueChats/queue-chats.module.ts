import { Module } from '@nestjs/common';
import { QueueChatController } from './queue-chats.controller';
import { QueueChatService } from './queue-chats.service';
import { QueueService } from 'queue/queue.service';

@Module({
  controllers: [QueueChatController],
  providers: [QueueService, QueueChatService],
})
export class QueueChatsModule {}
