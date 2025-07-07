import { LMSIntegrationController } from './lmsIntegration.controller';
import { Module } from '@nestjs/common';
import { LMSIntegrationService } from './lmsIntegration.service';
import { LMSIntegrationAdapter } from './lmsIntegration.adapter';
import { ScheduleModule } from '@nestjs/schedule';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { SyncLMSCommand } from './sync_lms.command';

@Module({
  imports: [ScheduleModule.forRoot(), ChatbotModule],
  controllers: [LMSIntegrationController],
  providers: [
    LMSIntegrationService,
    LMSIntegrationAdapter,
    ChatbotApiService,
    SyncLMSCommand,
  ],
  exports: [LMSIntegrationService],
})
export class LmsIntegrationModule {}
