import { DynamicModule, Module } from '@nestjs/common';
import { ChatbotDataSourceService } from './chatbot-datasource.service';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import * as options from '../../../chatbot_ormconfig';

@Module({
  providers: [
    {
      provide: ChatbotDataSourceService,
      useFactory: () => {
        return new ChatbotDataSourceService(
          options as PostgresConnectionOptions,
        );
      },
    },
  ],
  exports: [ChatbotDataSourceService],
})
export class ChatbotDataSourceModule {
  static forRoot(connectionOptions: PostgresConnectionOptions): DynamicModule {
    return {
      module: ChatbotDataSourceModule,
      providers: [
        {
          provide: ChatbotDataSourceService,
          useFactory: () => {
            return new ChatbotDataSourceService(connectionOptions);
          },
        },
      ],
      exports: [ChatbotDataSourceService],
    };
  }
}
