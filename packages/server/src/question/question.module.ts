import { forwardRef, Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { QuestionSubscriber } from './question.subscriber';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { QueueService } from '../queue/queue.service';
import { AlertsService } from '../alerts/alerts.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { NotificationService } from '../notification/notification.service';
import { QueueSSEService } from 'queue/queue-sse.service';
import { SSEModule } from 'sse/sse.module';
import { QueueChatsModule } from 'queueChats/queue-chats.module';

@Module({
  controllers: [QuestionController],
  providers: [
    ApplicationConfigService,
    QuestionSubscriber,
    QueueService,
    AlertsService,
    QuestionService,
    RedisQueueService,
    QueueChatService,
    NotificationService,
    QueueSSEService,
  ],
  imports: [
    NotificationModule,
    SSEModule,
    forwardRef(() => QueueModule),
    forwardRef(() => QueueChatsModule),
  ],
  exports: [
    QuestionService,
    AlertsService,
    NotificationService,
    QueueService,
    RedisQueueService,
    QueueChatService,
  ],
})
export class QuestionModule {}
