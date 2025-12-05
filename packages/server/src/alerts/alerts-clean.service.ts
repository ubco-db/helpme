import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertModel } from './alerts.entity';
import { AlertDeliveryMode } from '@koh/common';

@Injectable()
export class AlertsCleanService {
  // Daily cleanup: delete FEED alerts read more than 30 days ago
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneOldReadFeed(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await AlertModel.createQueryBuilder()
      .delete()
      .from(AlertModel)
      .where('"deliveryMode" = :mode', { mode: AlertDeliveryMode.FEED })
      .andWhere('"readAt" IS NOT NULL')
      .andWhere('"readAt" < :cutoff', { cutoff })
      .execute();
  }
}
