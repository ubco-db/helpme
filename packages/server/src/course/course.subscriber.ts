import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { CourseModel } from './course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class CourseSubscriber
  implements EntitySubscriberInterface<CourseModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return CourseModel;
  }

  async afterUpdate(event: UpdateEvent<CourseModel>): Promise<void> {
    // delete cached profiles for all users enrolled in this course
    await this.invalidateUsersInCourse(event.entity.id);
  }

  async beforeRemove(event: RemoveEvent<CourseModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }

    // delete cached profiles for all users enrolled in this course
    await this.invalidateUsersInCourse(event.entity.id);
  }

  private async invalidateUsersInCourse(courseId: number): Promise<void> {
    if (!courseId) {
      return;
    }

    // Get all user IDs for users enrolled in this course
    const userCourses = await UserCourseModel.find({
      where: { courseId },
      select: {
        userId: true,
      },
    });

    // Delete cached profiles for all users in this course
    const deletePromises = userCourses.map((userCourse) =>
      this.redisProfileService.deleteProfile(`u:${userCourse.userId}`),
    );

    await Promise.all(deletePromises);
  }
}
