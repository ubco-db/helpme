import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserModel } from '../profile/user.entity';
import { FindOptionsRelations } from 'typeorm';

export const User = createParamDecorator<FindOptionsRelations<UserModel>>(
  async (relations: FindOptionsRelations<UserModel>, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
      relations: relations || undefined,
    });
  },
);

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return Number(request.user.userId);
  },
);
