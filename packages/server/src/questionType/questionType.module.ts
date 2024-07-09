import { Module } from '@nestjs/common';
import { QuestionTypeController } from './questionType.controller';
import { ApplicationConfigModule } from '../config/application_config.module';
import { QuestionTypeService } from './questionType.service';

@Module({
  controllers: [QuestionTypeController],
  providers: [QuestionTypeService],
  imports: [ApplicationConfigModule],
})
export class QuestionTypeModule {}
