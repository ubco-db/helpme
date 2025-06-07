import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { OrganizationModel } from './organization.entity';
import { OrganizationUserModel } from './organization-user.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class OrganizationSubscriber
  implements EntitySubscriberInterface<OrganizationModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return OrganizationModel;
  }

  async afterUpdate(event: UpdateEvent<OrganizationModel>): Promise<void> {
    // Clear cached profiles for all users in the organization when org is updated
    await this.invalidateAllUsersInOrganization(event.entity.id);
  }

  async beforeRemove(event: RemoveEvent<OrganizationModel>): Promise<void> {
    // Clear cached profiles for all users in the organization when org is deleted
    if (!event.entity) {
      return;
    }
    await this.invalidateAllUsersInOrganization(event.entity.id);
  }

  private async invalidateAllUsersInOrganization(
    organizationId: number,
  ): Promise<void> {
    try {
      // Find all users in the organization
      const organizationUsers = await OrganizationUserModel.find({
        where: { organizationId },
        select: ['userId'],
      });

      // Clear profile cache for each user
      const cacheInvalidationPromises = organizationUsers
        .filter((orgUser) => orgUser.userId) // Ensure userId exists
        .map((orgUser) =>
          this.redisProfileService.deleteProfile(`u:${orgUser.userId}`),
        );

      await Promise.all(cacheInvalidationPromises);
    } catch (error) {
      console.error(
        `Failed to invalidate profile cache for organization ${organizationId}:`,
        error,
      );
    }
  }
}
