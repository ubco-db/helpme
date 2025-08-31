import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserModel } from '../profile/user.entity';
import { ERROR_MESSAGES, UserRole } from '@koh/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.setupData(request);

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.roleGuard.notLoggedIn);
    }

    if (user.userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        ERROR_MESSAGES.roleGuard.mustBeRoleToAccess(['ADMIN']),
      );
    }

    return true;
  }

  async setupData(request: any): Promise<UserModel> {
    return await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
    });
  }
}
