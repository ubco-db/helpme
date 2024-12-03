// I gave queue-clean its own module since it imports both questionservice and queueservice
// (this way, it helps avoid a circular dependency)
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { QuestionModule } from '../../question/question.module';
import { QuestionService } from '../../question/question.service';
import { QueueService } from '../../queue/queue.service';
import { RedisQueueService } from '../../redisQueue/redis-queue.service';
import { QueueCleanService } from './queue-clean.service';
import { QueueModule } from '../../queue/queue.module';
import { RedisQueueModule } from 'redisQueue/redis-queue.module';

@Module({
  providers: [
    QuestionService,
    QueueService,
    RedisQueueService,
    QueueCleanService,
  ],
  exports: [
    QueueCleanService,
    QueueService,
    RedisQueueService,
    QuestionService,
  ],
  imports: [
    QueueModule,
    QuestionModule,
    RedisQueueModule,
    ScheduleModule.forRoot(),
  ],
})
export class QueueCleanModule {}
