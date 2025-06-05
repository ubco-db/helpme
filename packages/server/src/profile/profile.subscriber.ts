import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { UserModel } from './user.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class ProfileSubscriber implements EntitySubscriberInterface<UserModel> {
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return UserModel;
  }

  async afterUpdate(event: UpdateEvent<UserModel>): Promise<void> {
    // delete cached profile whenever user is updated
    await this.redisProfileService.deleteProfile(`u:${event.entity.id}`);
  }

  async beforeRemove(event: RemoveEvent<UserModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (event.entity) {
      await this.redisProfileService.deleteProfile(`u:${event.entity.id}`);
    }
  }
}
