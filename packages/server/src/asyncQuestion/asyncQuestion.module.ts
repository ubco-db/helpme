import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { AsyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { ApplicationConfigService } from 'config/application_config.service';

@Module({
  controllers: [asyncQuestionController],
  providers: [
    AsyncQuestionService,
    RedisQueueService,
    ApplicationConfigService,
  ],
  imports: [
    NotificationModule,
    MailModule,
    RedisQueueService,
    ApplicationConfigService,
  ],
  exports: [AsyncQuestionService],
})
export class asyncQuestionModule {}

@Module({
  controllers: [asyncQuestionController],
  providers: [AsyncQuestionService, ApplicationConfigService],
  imports: [NotificationModule, MailTestingModule, ApplicationConfigService],
  exports: [AsyncQuestionService],
})
export class asyncQuestionTestingModule {}
