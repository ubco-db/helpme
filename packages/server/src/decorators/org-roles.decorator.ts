import { SetMetadata, CustomDecorator } from '@nestjs/common';

/* Specifies which org roles may be needed to access a route. Only to be used in tandem with OrgOrCourseRolesGuard (and CourseRoles decorator) */
export const OrgRoles = (...roles: string[]): CustomDecorator<string> =>
  SetMetadata('OrgRoles', roles);
