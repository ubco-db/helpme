import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserCourseModel } from 'profile/user-course.entity';

/* Gives the role of the user in the course */
export const CourseRole = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const courseId =
      request.params.courseId ??
      request.params.cid ??
      request.params.id ??
      null;
    const userCourse = await UserCourseModel.findOne({
      where: { userId: request.user.userId, courseId },
    });

    if (!userCourse) {
      throw new ForbiddenException('User is not enrolled in this course');
    }

    return userCourse.role;
  },
);
