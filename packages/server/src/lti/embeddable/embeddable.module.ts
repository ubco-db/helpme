import { Module } from '@nestjs/common';
import { ChatbotModule } from '../../chatbot/chatbot.module';
import { EmbeddableQuestionController } from './question/embeddable-question.controller';
import { EmbeddableQuestionService } from './question/embeddable-question.service';
import { QuestionGradingService } from './question/question-grading.service';

@Module({
  imports: [ChatbotModule],
  controllers: [EmbeddableQuestionController],
  providers: [EmbeddableQuestionService, QuestionGradingService],
  exports: [EmbeddableQuestionService],
})
export class EmbeddableModule {}
