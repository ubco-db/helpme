import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsCleanService } from './alerts-clean.service';
import { AlertsSubscriber } from './alerts.subscriber';
import { SSEModule } from 'sse/sse.module';
import { AlertsSSEService } from './alerts-sse.service';

@Module({
  imports: [SSEModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsCleanService,
    AlertsSSEService,
    AlertsSubscriber,
  ],
})
export class AlertsModule {}
