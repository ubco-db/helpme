import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { OrganizationUserModel } from './organization-user.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class OrganizationUserSubscriber
  implements EntitySubscriberInterface<OrganizationUserModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return OrganizationUserModel;
  }

  async afterInsert(event: InsertEvent<OrganizationUserModel>): Promise<void> {
    // delete cached profile when user-organization relationship is created
    await this.invalidateUserProfile(event.entity);
  }

  async afterUpdate(event: UpdateEvent<OrganizationUserModel>): Promise<void> {
    // delete cached profile when user-organization relationship is updated

    if (event.entity instanceof OrganizationUserModel) {
      await this.invalidateUserProfile(event.entity);
    } else {
      const orgUser = await OrganizationUserModel.findOne({
        where: { id: event.entity.id },
      });
      if (orgUser) {
        await this.invalidateUserProfile(orgUser);
      } else {
        console.error(
          'OrganizationUser failed to bust profile cache for event',
          event,
        );
      }
    }
  }

  async beforeRemove(event: RemoveEvent<OrganizationUserModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }

    // delete cached profile when user-organization relationship is deleted
    await this.invalidateUserProfile(event.entity);
  }

  private async invalidateUserProfile(
    entity: OrganizationUserModel,
  ): Promise<void> {
    let userId: number;

    if (entity.userId) {
      userId = entity.userId;
    } else if (entity.organizationUser?.id) {
      userId = entity.organizationUser.id;
    } else {
      // If user relationship is not loaded, we need to query for it
      const orgUser = await OrganizationUserModel.findOne({
        where: { id: entity.id },
      });
      if (orgUser?.userId) {
        userId = orgUser.userId;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }
}
