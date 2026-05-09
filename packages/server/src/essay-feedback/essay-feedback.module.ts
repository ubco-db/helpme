import { Module } from '@nestjs/common';
import { EssayFeedbackController } from './essay-feedback.controller';
import { EssayFeedbackService } from './essay-feedback.service';

@Module({
  controllers: [EssayFeedbackController],
  providers: [EssayFeedbackService],
})
export class EssayFeedbackModule {}
