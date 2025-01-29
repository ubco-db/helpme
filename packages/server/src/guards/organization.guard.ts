import { ERROR_MESSAGES } from '@koh/common';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserModel } from '../profile/user.entity';

@Injectable()
export class OrganizationGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = await this.setupData(request);
    const organizationId = request.params.oid;

    if (!user) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.roleGuard.userNotInOrganization,
      );
    }

    return await this.matchOrganizations(
      Number(organizationId),
      user.organizationId,
    );
  }

  async setupData(
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    request: any,
  ): Promise<{ user: UserModel }> {
    const user = await UserModel.findOne({
      where: {
        userId:
          request.params.uid || request.body.userId || request.user.userId,
        organizationId:
          request.params.oid ||
          request.params.organizationId ||
          request.params.orgId,
      },
    });

    return { user };
  }

  async matchOrganizations(
    organizationId: number,
    userOrganizationId: number,
  ): Promise<boolean> {
    if (userOrganizationId !== organizationId) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.roleGuard.userNotInOrganization,
      );
    }

    return true;
  }
}
