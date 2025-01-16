import { LMSIntegrationController } from './lmsIntegration.controller';
import { Module } from '@nestjs/common';
import { LMSIntegrationService } from './lmsIntegration.service';
import { LMSIntegrationAdapter } from './lmsIntegration.adapter';

@Module({
  imports: [],
  controllers: [LMSIntegrationController],
  providers: [LMSIntegrationService, LMSIntegrationAdapter],
  exports: [LMSIntegrationService],
})
export class LmsIntegrationModule {}
