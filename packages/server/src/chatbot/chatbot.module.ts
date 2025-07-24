import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotApiService } from './chatbot-api.service';
import { CourseChatbotSettingsSubscriber } from './chatbot-infrastructure-models/course-chatbot-settings.subscriber';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  controllers: [ChatbotController],
  imports: [CacheModule.register()],
  providers: [
    ChatbotService,
    ChatbotApiService,
    CourseChatbotSettingsSubscriber,
  ],
})
export class ChatbotModule {}
