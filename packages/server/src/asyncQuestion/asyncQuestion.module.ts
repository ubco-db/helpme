import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { asyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { ApplicationConfigService } from 'config/application_config.service';

@Module({
  controllers: [asyncQuestionController],
  providers: [
    asyncQuestionService,
    RedisQueueService,
    ApplicationConfigService,
  ],
  imports: [
    NotificationModule,
    MailModule,
    RedisQueueService,
    ApplicationConfigService,
  ],
  exports: [asyncQuestionService],
})
export class asyncQuestionModule {}

@Module({
  controllers: [asyncQuestionController],
  providers: [asyncQuestionService, ApplicationConfigService],
  imports: [NotificationModule, MailTestingModule, ApplicationConfigService],
  exports: [asyncQuestionService],
})
export class asyncQuestionTestingModule {}
