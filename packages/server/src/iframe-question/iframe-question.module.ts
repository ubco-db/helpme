import { Module } from '@nestjs/common';
import { IframeQuestionController } from './iframe-question.controller';
import { IframeQuestionService } from './iframe-question.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [IframeQuestionController],
  providers: [IframeQuestionService],
})
export class IframeQuestionModule {}
