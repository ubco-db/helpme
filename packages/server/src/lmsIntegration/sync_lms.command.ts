import { Command } from 'nestjs-command';
import { Injectable } from '@nestjs/common';
import { LMSIntegrationService } from './lmsIntegration.service';

@Injectable()
export class SyncLMSCommand {
  constructor(private lmsIntegrationService: LMSIntegrationService) {}
  @Command({
    command: 'lms:sync',
    describe:
      'runs the job which resynchronizes LMS integrated courses; requires the chatbot service to be online',
  })
  async sync(): Promise<void> {
    await this.lmsIntegrationService.resynchronizeCourseIntegrations();
  }
}
