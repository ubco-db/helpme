import { Module } from '@nestjs/common';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';
import { FactoryService } from 'factory/factory.service';
import { SeedChatbotAgentGroupCommand } from './seed-chatbot-agent-group.command';

@Module({
  controllers: [SeedController],
  providers: [SeedService, FactoryService, SeedChatbotAgentGroupCommand],
})
export class SeedModule {}
