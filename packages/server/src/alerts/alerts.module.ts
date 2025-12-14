import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsCleanService } from './alerts-clean.service';

@Module({
  imports: [],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsCleanService],
})
export class AlertsModule {}
