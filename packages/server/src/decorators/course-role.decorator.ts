import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';

export const CourseRole = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const courseId = request.params.courseId;
    const user = await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
      relations: {
        courses: true,
      },
    });

    const userCourse = user.courses.find((course) => {
      return Number(course.courseId) === Number(courseId);
    });
    return userCourse.role;
  },
);
