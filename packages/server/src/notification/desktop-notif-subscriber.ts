import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
} from 'typeorm';
import { DesktopNotifModel } from './desktop-notif.entity';
import { NotificationService } from './notification.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class DesktopNotifSubscriber
  implements EntitySubscriberInterface<DesktopNotifModel>
{
  notifService: NotificationService;
  constructor(
    @InjectDataSource()
    dataSource: DataSource,
    notifService: NotificationService,
    private readonly redisProfileService: RedisProfileService,
  ) {
    this.notifService = notifService;
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return DesktopNotifModel;
  }

  async afterInsert(event: InsertEvent<DesktopNotifModel>): Promise<void> {
    await this.notifService.notifyDesktop(
      event.entity,
      "You've successfully signed up for desktop notifications!",
    );
    await this.redisProfileService.deleteProfile(`u:${event.entity.user.id}`);
  }

  async afterRemove(event: RemoveEvent<DesktopNotifModel>): Promise<void> {
    await this.redisProfileService.deleteProfile(`u:${event.entity.user.id}`);
  }
}
