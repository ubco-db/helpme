import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { UserTokenModel } from './user-token.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class UserTokenSubscriber
  implements EntitySubscriberInterface<UserTokenModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return UserTokenModel;
  }

  async afterUpdate(event: UpdateEvent<UserTokenModel>): Promise<void> {
    // delete cached profile whenever user token is updated
    let userId: number;

    if (event.entity.userId || event.entity.user?.id) {
      userId = event.entity.userId || event.entity.user.id;
    } else {
      // If user relationship is not loaded, we need to query for it
      const userToken = await UserTokenModel.findOne({
        where: { id: event.entity.id },
        relations: ['user'],
      });
      if (userToken?.user?.id) {
        userId = userToken.user.id;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }

  async beforeRemove(event: RemoveEvent<UserTokenModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }

    let userId: number;

    if (event.entity.user?.id || (event.entity as any).userId) {
      userId = event.entity.user?.id || (event.entity as any).userId;
    } else {
      // If user relationship is not loaded, we need to query for it
      const userToken = await UserTokenModel.findOne({
        where: { id: event.entity.id },
        relations: ['user'],
      });
      if (userToken?.user?.id) {
        userId = userToken.user.id;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }
}
