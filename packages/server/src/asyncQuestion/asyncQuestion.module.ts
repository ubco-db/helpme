import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { asyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { RedisQueueModule } from '../redisQueue/redis-queue.module';

@Module({
  controllers: [asyncQuestionController],
  providers: [asyncQuestionService, RedisQueueService],
  imports: [NotificationModule, MailModule, RedisQueueModule],
  exports: [asyncQuestionService],
})
export class asyncQuestionModule {}

@Module({
  controllers: [asyncQuestionController],
  providers: [asyncQuestionService],
  imports: [NotificationModule, MailTestingModule],
  exports: [asyncQuestionService],
})
export class asyncQuestionTestingModule {}
