import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotApiService } from './chatbot-api.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotApiService],
})
export class ChatbotModule {}
