import { ERROR_MESSAGES } from '@koh/common';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationUserModel } from 'organization/organization-user.entity';

@Injectable()
export class OrganizationRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let roles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!roles) {
      // if it doesn't have the roles decorator, maybe it has the OrgRoles decorator?
      roles = this.reflector.get<string[]>('OrgRoles', context.getHandler());
      if (!roles) {
        // if it lacks any role decorator, then this guard won't do anything (TODO: maybe throw a NotImplementedException instead? Though doing this may break some endpoints)
        return true;
      }
    }

    const request = context.switchToHttp().getRequest();
    const { user } = await this.setupData(request);

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.roleGuard.notLoggedIn);
    }

    return this.matchRoles(roles, user);
  }

  async setupData(
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    request: any,
  ): Promise<{ user: OrganizationUserModel }> {
    const user = await OrganizationUserModel.findOne({
      where: {
        userId: request.user.userId,
        organizationId: request.params.oid,
      },
    });

    return { user };
  }

  async matchRoles(
    roles: string[],
    user: OrganizationUserModel,
  ): Promise<boolean> {
    const remaining = roles.filter((role) => {
      return user.role.toString() === role;
    });

    if (remaining.length <= 0) {
      throw new ForbiddenException(
        ERROR_MESSAGES.roleGuard.mustBeRoleToAccess(roles),
      );
    }

    return true;
  }
}
