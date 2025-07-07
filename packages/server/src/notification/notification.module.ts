import { Module } from '@nestjs/common';
import { DesktopNotifSubscriber } from './desktop-notif-subscriber';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, DesktopNotifSubscriber, RedisProfileService],
  exports: [NotificationService],
})
export class NotificationModule {}
