import { SetMetadata, CustomDecorator } from '@nestjs/common';

/* Specifies which course roles may be needed to access a route. Only to be used in tandem with OrgOrCourseRolesGuard (and OrgRoles decorator) */
export const CourseRoles = (...roles: string[]): CustomDecorator<string> =>
  SetMetadata('CourseRoles', roles);
