import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationUserModel } from '../organization/organization-user.entity';

/* Gives the role of the user in the course */
export const OrgRole = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const organizationId =
      request.params.organizationId ?? request.params.oid ?? null;
    const orgUser = await OrganizationUserModel.findOne({
      where: {
        userId: request.user.userId,
        organizationId: organizationId,
      },
    });

    if (!orgUser) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    return orgUser.role;
  },
);
