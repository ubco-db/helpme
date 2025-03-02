import { SetMetadata, CustomDecorator } from '@nestjs/common';

/* Specifies which roles (org or course roles) are needed in order to access a route. Needs to be used in tandem with either OrganizationRolesGuard or CourseRolesGuard. */
export const Roles = (...roles: string[]): CustomDecorator<string> =>
  SetMetadata('roles', roles);
