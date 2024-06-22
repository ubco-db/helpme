import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { QuestionSubscriber } from './question.subscriber';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { QueueService } from '../queue/queue.service';
import { AlertsService } from '../alerts/alerts.service';

@Module({
  controllers: [QuestionController],
  providers: [
    QuestionSubscriber,
    QueueService,
    AlertsService,
    QuestionService,
    RedisQueueService,
  ],
  imports: [NotificationModule, QueueModule],
  exports: [QuestionService],
})
export class QuestionModule {}
