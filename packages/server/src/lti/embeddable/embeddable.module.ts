import { Module } from '@nestjs/common'
import { EmbeddableQuestionController } from './question/embeddable-question.controller'
import { EmbeddableQuestionService } from './question/embeddable-question.service'
import { ChatbotModule } from '../../chatbot/chatbot.module'
import { EmbeddableAssignmentController } from './assignment/embeddable-assignment.controller'
import { EmbeddableModuleService } from './embeddable-module.service'
import { EmbeddableAssignmentService } from './assignment/embeddable-assignment.service'

@Module({
  imports: [ChatbotModule],
  controllers: [EmbeddableQuestionController, EmbeddableAssignmentController],
  providers: [EmbeddableQuestionService, EmbeddableAssignmentService, EmbeddableModuleService],
})
export class EmbeddableModule {}