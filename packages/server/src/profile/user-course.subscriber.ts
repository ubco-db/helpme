import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { UserCourseModel } from './user-course.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class UserCourseSubscriber
  implements EntitySubscriberInterface<UserCourseModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return UserCourseModel;
  }

  async afterUpdate(event: UpdateEvent<UserCourseModel>): Promise<void> {
    // delete cached profile whenever user course is updated
    let userId: number;

    if (event.entity.user?.id) {
      userId = event.entity.user.id;
    } else if (event.entity.userId) {
      userId = event.entity.userId;
    } else {
      // If user relationship is not loaded, we need to query for it
      const userCourse = await UserCourseModel.findOne({
        where: { id: event.entity.id },
        relations: ['user'],
      });
      if (userCourse?.user?.id) {
        userId = userCourse.user.id;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }

  async beforeRemove(event: RemoveEvent<UserCourseModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }

    let userId: number;

    if (event.entity.user?.id) {
      userId = event.entity.user.id;
    } else if (event.entity.userId) {
      userId = event.entity.userId;
    } else {
      // If user relationship is not loaded, we need to query for it
      const userCourse = await UserCourseModel.findOne({
        where: { id: event.entity.id },
        relations: ['user'],
      });
      if (userCourse?.user?.id) {
        userId = userCourse.user.id;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }

  async afterInsert(event: InsertEvent<UserCourseModel>): Promise<void> {
    let userId: number;

    if (event.entity.user?.id) {
      userId = event.entity.user.id;
    } else if (event.entity.userId) {
      userId = event.entity.userId;
    } else {
      // If user relationship is not loaded, we need to query for it
      const userCourse = await UserCourseModel.findOne({
        where: { id: event.entity.id },
        relations: ['user'],
      });
      if (userCourse?.user?.id) {
        userId = userCourse.user.id;
      }
    }

    if (userId) {
      await this.redisProfileService.deleteProfile(`u:${userId}`);
    }
  }
}
