import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueCleanService } from './queue-clean/queue-clean.service';
import { SSEModule } from 'sse/sse.module';
import { QueueService } from './queue.service';
import { QueueSSEService } from './queue-sse.service';
import { QueueSubscriber } from './queue.subscriber';
import { AlertsService } from '../alerts/alerts.service';
import { AlertsModule } from '../alerts/alerts.module';
import { RedisQueueService } from 'redisQueue/redis-queue.service';

@Module({
  controllers: [QueueController],
  providers: [
    QueueCleanService,
    QueueService,
    QueueSSEService,
    QueueSubscriber,
    AlertsService,
    RedisQueueService,
  ],
  exports: [QueueCleanService, QueueSSEService],
  imports: [SSEModule, AlertsModule],
})
export class QueueModule {}
