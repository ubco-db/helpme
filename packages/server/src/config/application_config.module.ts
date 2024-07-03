import { Module } from '@nestjs/common';
import { ApplicationConfigService } from './application_config.service';

@Module({
  providers: [ApplicationConfigService],
  exports: [ApplicationConfigService],
})
export class ApplicationConfigModule {}

@Module({
  providers: [
    {
      provide: ApplicationConfigService,
      // Use an empty class for a mock implementation
      useValue: {
        get(key: string): number {
          return 100;
        },
      },
    },
  ],
  exports: [ApplicationConfigService],
})
export class ApplicationTestingConfigModule {}
