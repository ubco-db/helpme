import { LMSIntegrationController } from './lmsIntegration.controller';
import { Module } from '@nestjs/common';
import { LMSIntegrationService } from './lmsIntegration.service';

@Module({
  controllers: [LMSIntegrationController],
  providers: [LMSIntegrationService],
})
export class LmsIntegrationModule {}
