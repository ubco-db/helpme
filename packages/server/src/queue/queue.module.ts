import { forwardRef, Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { SSEModule } from 'sse/sse.module';
import { QueueService } from './queue.service';
import { QueueSSEService } from './queue-sse.service';
import { QueueSubscriber } from './queue.subscriber';
import { AlertsService } from '../alerts/alerts.service';
import { AlertsModule } from '../alerts/alerts.module';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { QueueInviteController } from './queue-invite.controller';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { QueueChatsModule } from 'queueChats/queue-chats.module';
import { QueueCleanService } from './queue-clean/queue-clean.service';
import { QuestionModule } from '../question/question.module';
import { QuestionService } from '../question/question.service';

@Module({
  controllers: [QueueController, QueueInviteController],
  providers: [
    QueueService,
    ApplicationConfigService,
    QueueSSEService,
    QueueSubscriber,
    AlertsService,
    RedisQueueService,
    QueueCleanService,
    QuestionService,
  ],
  exports: [
    QueueSSEService,
    QueueCleanService,
    ApplicationConfigService,
    AlertsService,
    QuestionService,
    QueueService,
    RedisQueueService,
  ],
  imports: [
    ApplicationConfigService,
    SSEModule,
    AlertsModule,
    forwardRef(() => QueueChatsModule),
    forwardRef(() => QuestionModule),
  ],
})
export class QueueModule {}
