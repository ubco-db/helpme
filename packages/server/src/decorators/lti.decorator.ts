import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { FindOptionsRelations } from 'typeorm';
import { IdToken } from 'lti-typescript';

export const UserCourse = createParamDecorator<
  FindOptionsRelations<UserCourseModel>
>(
  async (
    relations: FindOptionsRelations<UserCourseModel>,
    ctx: ExecutionContext,
  ): Promise<UserCourseModel> => {
    const ucid = ctx.switchToHttp().getResponse().locals['ucid'];
    if (ucid === undefined || ucid === null) {
      return null;
    }
    return await UserCourseModel.findOne({
      where: { id: ucid },
      relations: {
        ...relations,
        user: relations.user ?? true,
        course: relations.course ?? true,
      },
    });
  },
);
export const UserCourseId = createParamDecorator(
  (ctx: ExecutionContext): number => {
    const ucid = ctx.switchToHttp().getResponse().locals['ucid'];
    if (ucid === undefined || ucid === null) {
      return null;
    }
    return ucid;
  },
);

export const LtiToken = createParamDecorator(
  (ctx: ExecutionContext): IdToken => {
    const token = ctx.switchToHttp().getRequest().locals['token'];
    if (token === undefined || token === null) {
      return null;
    }
    return token;
  },
);
