import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FindOptionsRelations } from 'typeorm';
import { IdToken } from '@bhunt02/lti-typescript';
import { UserModel } from '../profile/user.entity';
import { CourseModel } from '../course/course.entity';

export const LtiUser = createParamDecorator<FindOptionsRelations<UserModel>>(
  async (
    relations: FindOptionsRelations<UserModel>,
    ctx: ExecutionContext,
  ): Promise<UserModel> => {
    const userId = ctx.switchToHttp().getResponse().locals['userId'];
    if (!userId) {
      return undefined;
    }
    return await UserModel.findOne({
      where: { id: userId },
      relations: {
        ...relations,
      },
    });
  },
);

export const LtiCourse = createParamDecorator<
  FindOptionsRelations<CourseModel>
>(
  async (
    relations: FindOptionsRelations<CourseModel>,
    ctx: ExecutionContext,
  ): Promise<CourseModel> => {
    const courseId = ctx.switchToHttp().getResponse().locals['courseId'];
    if (!courseId) {
      return undefined;
    }
    return await CourseModel.findOne({
      where: { id: courseId },
      relations: {
        ...relations,
      },
    });
  },
);

export const LtiUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    return ctx.switchToHttp().getResponse().locals['userId'];
  },
);

export const LtiCourseId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number => {
    return ctx.switchToHttp().getResponse().locals['courseId'];
  },
);

export const LtiToken = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): IdToken => {
    return ctx.switchToHttp().getResponse().locals['token'];
  },
);
