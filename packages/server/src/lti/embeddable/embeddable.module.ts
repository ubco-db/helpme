import { Module } from '@nestjs/common';
import { ChatbotModule } from '../../chatbot/chatbot.module';
import { EmbeddableQuestionController } from './question/embeddable-question.controller';
import { EmbeddableQuestionService } from './question/embeddable-question.service';
import { EmbeddableQuizController } from './quiz/embeddable-quiz.controller';
import { EmbeddableQuizService } from './quiz/embeddable-quiz.service';
import { QuestionGradingService } from './question/question-grading.service';

@Module({
  imports: [ChatbotModule],
  controllers: [EmbeddableQuestionController, EmbeddableQuizController],
  providers: [
    EmbeddableQuestionService,
    EmbeddableQuizService,
    QuestionGradingService,
  ],
  exports: [EmbeddableQuestionService, EmbeddableQuizService],
})
export class EmbeddableModule {}
