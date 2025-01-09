import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { QueueModel } from '../queue/queue.entity';
import { UserCourseModel } from 'profile/user-course.entity';

export const QueueRole = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const queue = await QueueModel.findOne(request.params.queueId);
    const courseId = queue?.courseId;
    const userCourse = await UserCourseModel.findOne({
      where: { userId: request.user.userId, courseId },
    });

    if (!userCourse) {
      throw new UnauthorizedException('User is not enrolled in this course');
    }

    return userCourse.role;
  },
);
