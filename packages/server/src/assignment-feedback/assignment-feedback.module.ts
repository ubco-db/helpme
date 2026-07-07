import { Module } from '@nestjs/common';
import { AssignmentFeedbackController } from './assignment-feedback.controller';
import { AssignmentFeedbackService } from './assignment-feedback.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [AssignmentFeedbackController],
  providers: [AssignmentFeedbackService],
})
export class AssignmentFeedbackModule {}
