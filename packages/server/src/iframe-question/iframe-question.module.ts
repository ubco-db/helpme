import { Module } from '@nestjs/common';
import { IframeQuestionController } from './iframe-question.controller';
import { IframeQuestionService } from './iframe-question.service';

@Module({
  controllers: [IframeQuestionController],
  providers: [IframeQuestionService],
})
export class IframeQuestionModule {}
