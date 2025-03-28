import { Module } from '@nestjs/common';
import { QueueChatController } from './queue-chats.controller';
import { QueueChatService } from './queue-chats.service';
import { QueueService } from 'queue/queue.service';
import { AlertsService } from 'alerts/alerts.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { SSEService } from 'sse/sse.service';
import { QueueChatSSEService } from './queue-chats-sse.service';
import { QueueSSEService } from 'queue/queue-sse.service';
@Module({
  controllers: [QueueChatController],
  providers: [
    QueueService,
    QueueChatService,
    AlertsService,
    ApplicationConfigService,
    QueueChatSSEService,
    SSEService,
    QueueSSEService,
  ],
  exports: [QueueChatService],
})
export class QueueChatsModule {}
