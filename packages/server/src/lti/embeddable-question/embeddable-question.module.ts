import { Module } from '@nestjs/common';
import { EmbeddableQuestionController } from './embeddable-question.controller';
import { EmbeddableQuestionService } from './embeddable-question.service';
import { ChatbotModule } from '../../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [EmbeddableQuestionController],
  providers: [EmbeddableQuestionService],
})
export class EmbeddableQuestionModule {}
