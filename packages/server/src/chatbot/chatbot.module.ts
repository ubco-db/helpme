import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotApiService } from './chatbot-api.service';
import { ChatbotSettingsSubscriber } from './chatbot-infrastructure-models/chatbot-settings.subscriber';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  controllers: [ChatbotController],
  imports: [CacheModule.register()],
  providers: [ChatbotService, ChatbotApiService, ChatbotSettingsSubscriber],
})
export class ChatbotModule {}
