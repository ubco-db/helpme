import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UserCourseModel } from 'profile/user-course.entity';

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
      throw new UnauthorizedException('User is not enrolled in this course');
    }

    return userCourse.role;
  },
);
