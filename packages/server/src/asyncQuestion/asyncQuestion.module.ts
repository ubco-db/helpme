import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { asyncQuestionController } from './asyncQuestion.controller';
import { asyncQuestionService } from './asyncQuestion.service';
import { MailModule, MailTestingModule } from 'mail/mail.module';
import { QuestionService } from '../question/question.service';

@Module({
  controllers: [asyncQuestionController],
  providers: [asyncQuestionService],
  imports: [NotificationModule, MailModule],
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
