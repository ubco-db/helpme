import { Module } from '@nestjs/common';
import { QuestionTypeController } from './questionType.controller';
import { ApplicationConfigModule } from '../config/application_config.module';

@Module({
  controllers: [QuestionTypeController],
  imports: [ApplicationConfigModule],
})
export class QuestionTypeModule {}
