import { Module } from '@nestjs/common';
import { EssayFeedbackController } from './essay-feedback.controller';
import { EssayFeedbackService } from './essay-feedback.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [EssayFeedbackController],
  providers: [EssayFeedbackService],
})
export class EssayFeedbackModule {}
