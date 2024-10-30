import { Module } from '@nestjs/common';
import { QueueChatController } from './queue-chats.controller';
import { QueueChatService } from './queue-chats.service';
import { QueueService } from 'queue/queue.service';
import { AlertsService } from 'alerts/alerts.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { QueueSSEService } from 'queue/queue-sse.service';
import { SSEService } from 'sse/sse.service';

@Module({
  controllers: [QueueChatController],
  providers: [
    QueueService,
    QueueChatService,
    AlertsService,
    ApplicationConfigService,
    QueueSSEService,
    SSEService,
  ],
  exports: [QueueChatService],
})
export class QueueChatsModule {}