import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { SemesterModel } from './semester.entity';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@EventSubscriber()
export class SemesterSubscriber
  implements EntitySubscriberInterface<SemesterModel>
{
  constructor(
    private readonly redisProfileService: RedisProfileService,
    dataSource: DataSource,
  ) {
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return SemesterModel;
  }

  async afterUpdate(event: UpdateEvent<SemesterModel>): Promise<void> {
    // delete cached profiles for all users in courses within this semester
    await this.invalidateUsersInSemester(event.entity.id);
  }

  async beforeRemove(event: RemoveEvent<SemesterModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (!event.entity) {
      return;
    }

    // delete cached profiles for all users in courses within this semester
    await this.invalidateUsersInSemester(event.entity.id);
  }

  private async invalidateUsersInSemester(semesterId: number): Promise<void> {
    if (!semesterId) {
      return;
    }

    // Get all user IDs for users enrolled in courses within this semester
    // Using a join query to efficiently get all user IDs in one database call
    const userIds = await UserCourseModel.createQueryBuilder('uc')
      .innerJoin(CourseModel, 'c', 'c.id = uc.courseId')
      .select('DISTINCT uc.userId', 'userId')
      .where('c.semesterId = :semesterId', { semesterId })
      .getRawMany();

    // Delete cached profiles for all users in courses within this semester
    const deletePromises = userIds.map((result) =>
      this.redisProfileService.deleteProfile(`u:${result.userId}`),
    );

    await Promise.all(deletePromises);
  }
}
