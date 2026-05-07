import { Module } from '@nestjs/common';
import { IFrameQuestionController } from './iframe-question.controller';
import { IFrameQuestionService } from './iframe-question.service';
import { ChatbotModule } from '../../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [IFrameQuestionController],
  providers: [IFrameQuestionService],
})
export class IFrameQuestionModule {}
