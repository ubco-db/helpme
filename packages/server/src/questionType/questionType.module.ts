import { Module } from '@nestjs/common';
import { QuestionTypeController } from './questionType.controller';

@Module({
  controllers: [QuestionTypeController],
})
export class QuestionTypeModule {}
