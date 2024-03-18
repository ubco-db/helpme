import { AccountType } from '@koh/common';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.setupData(request);

    return this.accountVerified(user);
  }

  async setupData(request: any): Promise<UserModel> {
    const user = await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
    });

    return user;
  }

  async accountVerified(user: UserModel): Promise<boolean> {
    if (!user) {
      return false;
    }

    if (!user.emailVerified && user.accountType === AccountType.LEGACY) {
      return false;
    }

    return true;
  }
}
