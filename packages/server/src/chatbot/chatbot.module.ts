import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotApiService } from './chatbot-api.service';
import { ChatbotSettingsSubscriber } from './chatbot-infrastructure-models/chatbot-settings.subscriber';
import { CacheModule } from '@nestjs/cache-manager';
import { ChatbotDataSourceModule } from './chatbot-datasource/chatbot-datasource.module';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ChatbotResultGateway } from './intermediate-results/chatbot-result.gateway';
import { WebsocketModule } from '../websocket/websocket.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../login/jwt.strategy';

@Module({
  controllers: [ChatbotController],
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    CacheModule.register(),
    ChatbotDataSourceModule,
    WebsocketModule,
  ],
  providers: [
    JwtStrategy,
    ChatbotService,
    ChatbotApiService,
    ChatbotSettingsSubscriber,
    ChatbotResultGateway,
  ],
  exports: [ChatbotApiService, ChatbotResultGateway],
})
export class ChatbotModule {
  static forRoot(connectionOptions: PostgresConnectionOptions) {
    return {
      module: ChatbotModule,
      imports: [
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            secret: configService.get('JWT_SECRET'),
          }),
        }),
        CacheModule.register(),
        ChatbotDataSourceModule.forRoot(connectionOptions),
        WebsocketModule,
      ],
      providers: [
        ChatbotService,
        ChatbotApiService,
        ChatbotSettingsSubscriber,
        ChatbotResultGateway,
      ],
      exports: [ChatbotApiService, ChatbotResultGateway],
    };
  }
}
