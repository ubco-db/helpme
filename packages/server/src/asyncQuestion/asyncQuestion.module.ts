import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { AsyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { RedisQueueModule } from '../redisQueue/redis-queue.module';
import { ChatbotModule } from 'chatbot/chatbot.module';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';

@Module({
  controllers: [asyncQuestionController],
  providers: [
    AsyncQuestionService,
    RedisQueueService,
    ApplicationConfigService,
    ChatbotApiService,
  ],
  imports: [NotificationModule, MailModule, RedisQueueModule, ChatbotModule],
  exports: [AsyncQuestionService],
})
export class asyncQuestionModule {}

@Module({
  controllers: [asyncQuestionController],
  providers: [
    AsyncQuestionService,
    ChatbotApiService,
    ApplicationConfigService,
  ],
  imports: [NotificationModule, MailTestingModule, ChatbotModule],
  exports: [AsyncQuestionService],
})
export class asyncQuestionTestingModule {}
