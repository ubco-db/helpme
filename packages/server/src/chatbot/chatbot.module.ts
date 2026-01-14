import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotApiService } from './chatbot-api.service';
import { ChatbotSettingsSubscriber } from './chatbot-infrastructure-models/chatbot-settings.subscriber';
import { CacheModule } from '@nestjs/cache-manager';
import { ChatbotDataSourceService } from './chatbot-datasource/chatbot-datasource.service';
import { ChatbotDataSourceModule } from './chatbot-datasource/chatbot-datasource.module';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { MailService } from 'mail/mail.service';

@Module({
  controllers: [ChatbotController],
  imports: [CacheModule.register(), ChatbotDataSourceModule],
  providers: [ChatbotService, ChatbotApiService, ChatbotSettingsSubscriber],
})
export class ChatbotModule {
  static forRoot(connectionOptions: PostgresConnectionOptions) {
    return {
      module: ChatbotModule,
      imports: [
        CacheModule.register(),
        ChatbotDataSourceModule.forRoot(connectionOptions),
      ],
      providers: [
        ChatbotService,
        ChatbotApiService,
        ChatbotSettingsSubscriber,
        MailService,
      ],
    };
  }
}
