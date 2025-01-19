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
  ],
  imports: [NotificationModule, forwardRef(() => QueueModule)],
  exports: [
    QuestionService,
    AlertsService,
    NotificationService,
    QueueService,
    RedisQueueService,
  ],
})
export class QuestionModule {}
