import { Module } from '@nestjs/common';
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
import { QueueCleanService } from './queue-clean/queue-clean.service';
import { QueueCleanModule } from './queue-clean/queue-clean.module';

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
  ],
  exports: [QueueSSEService, ApplicationConfigService],
  imports: [
    ApplicationConfigService,
    SSEModule,
    AlertsModule,
    QueueCleanModule,
  ],
})
export class QueueModule {}
