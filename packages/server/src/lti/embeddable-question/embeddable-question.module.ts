import { Module } from '@nestjs/common';
import { ChatbotModule } from '../../chatbot/chatbot.module';
import { EmbeddableQuestionController } from './embeddable-question.controller';
import { EmbeddableQuestionService } from './embeddable-question.service';
import { QuestionGradingService } from './question-grading.service';

@Module({
  imports: [ChatbotModule],
  controllers: [EmbeddableQuestionController],
  providers: [EmbeddableQuestionService, QuestionGradingService],
  exports: [EmbeddableQuestionService, QuestionGradingService],
})
export class EmbeddableQuestionModule {}
