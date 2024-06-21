import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { asyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';

@Module({
  controllers: [asyncQuestionController],
  providers: [asyncQuestionService, RedisQueueService],
  imports: [NotificationModule, MailModule, RedisQueueService],
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
