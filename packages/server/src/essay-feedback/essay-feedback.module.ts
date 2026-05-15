import { Module } from '@nestjs/common';
import { EssayFeedbackController } from './essay-feedback.controller';
import { EssayFeedbackService } from './essay-feedback.service';
<<<<<<< Updated upstream
import { ChatbotModule } from '../chatbot/chatbot.module';
=======
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
>>>>>>> Stashed changes

@Module({
  imports: [ChatbotModule],
  controllers: [EssayFeedbackController],
  providers: [EssayFeedbackService, ChatbotApiService],
})
export class EssayFeedbackModule {}
