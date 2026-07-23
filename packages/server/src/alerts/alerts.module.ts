import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsCleanService } from './alerts-clean.service';
import { AlertsSubscriber } from './alerts.subscriber';
import { SSEModule } from 'sse/sse.module';
import { AlertsSSEService } from './alerts-sse.service';
import { MailModule } from 'mail/mail.module';

@Module({
  imports: [SSEModule, MailModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsCleanService,
    AlertsSSEService,
    AlertsSubscriber,
  ],
})
export class AlertsModule {}
