import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { FactoryService } from 'factory/factory.service';
import { SeedChatbotAgentGroupCommand } from './seed-chatbot-agent-group.command';
import { BackupModule } from 'backup/backup.module';

@Module({
  imports: [BackupModule],
  controllers: [SeedController],
  providers: [SeedService, FactoryService, SeedChatbotAgentGroupCommand],
})
export class SeedModule {}
