import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { AsyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { RedisQueueModule } from '../redisQueue/redis-queue.module';

@Module({
  controllers: [asyncQuestionController],
  providers: [
    AsyncQuestionService,
    RedisQueueService,
    ApplicationConfigService,
  ],
  imports: [NotificationModule, MailModule, RedisQueueModule],
  exports: [AsyncQuestionService],
})
export class asyncQuestionModule {}

@Module({
  controllers: [asyncQuestionController],
  providers: [AsyncQuestionService, ApplicationConfigService],
  imports: [NotificationModule, MailTestingModule],
  exports: [AsyncQuestionService],
})
export class asyncQuestionTestingModule {}
