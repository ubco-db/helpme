import { LMSIntegrationController } from './lmsIntegration.controller';
import { Module } from '@nestjs/common';
import { LMSIntegrationService } from './lmsIntegration.service';
import { LMSIntegrationAdapter } from './lmsIntegration.adapter';

@Module({
  controllers: [LMSIntegrationController],
  providers: [LMSIntegrationService, LMSIntegrationAdapter],
})
export class LmsIntegrationModule {}
