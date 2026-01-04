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
import { QuestionModule } from '../question/question.module';
import { QuestionService } from '../question/question.service';
import { ApplicationConfigModule } from '../config/application_config.module';
import { RedisQueueModule } from '../redisQueue/redis-queue.module';
import { QueueStaffService } from './queue-staff/queue-staff.service';

@Module({
  controllers: [QueueController, QueueInviteController],
  providers: [
    QueueService,
    ApplicationConfigService,
    RedisQueueService,
    QueueSSEService,
    QueueSubscriber,
    AlertsService,
    QuestionService,
    QueueStaffService,
  ],
  exports: [
    QueueSSEService,
    AlertsService,
    QuestionService,
    QueueService,
    RedisQueueService,
    QueueStaffService,
  ],
  imports: [
    ApplicationConfigModule,
    RedisQueueModule,
    SSEModule,
    AlertsModule,
    forwardRef(() => QueueChatsModule),
    forwardRef(() => QuestionModule),
  ],
})
export class QueueModule {}
