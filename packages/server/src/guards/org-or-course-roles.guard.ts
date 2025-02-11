import { ERROR_MESSAGES } from '@koh/common';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  NotImplementedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { UserModel } from 'profile/user.entity';

/* The user must have one of the specified CourseRoles OR OrgRoles in order to access this endpoint.
    This could be used if there was an endpoint you want the course professor to be able to use or the org admin.
    Note that you DO need a courseId or cid parameter.
    You do NOT need an orgId or oid parameter, as the org is determined by the course.
*/
@Injectable()
export class OrgOrCourseRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  /* see https://docs.nestjs.com/guards for more details about this */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const orgRoles = this.reflector.get<string[]>(
      'OrgRoles',
      context.getHandler(),
    );
    const courseRoles = this.reflector.get<string[]>(
      'CourseRoles',
      context.getHandler(),
    );
    const roles = this.reflector.get<string[]>('roles', context.getHandler());

    if (!orgRoles || !courseRoles || roles) {
      throw new NotImplementedException(
        'This endpoint is missing either @OrgRoles or @CourseRoles (needs both). It should not use @Roles',
      );
    }

    const request = context.switchToHttp().getRequest();
    const { user } = await this.setupData(request);

    const courseId = request.params.courseId ?? request.params.cid ?? null;

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.roleGuard.notLoggedIn);
    }
    if (!courseId) {
      throw new NotFoundException(ERROR_MESSAGES.roleGuard.noCourseIdFound);
    }

    // first check if they have the right course role (since usually that will get resolved first)
    if (this.matchCourseRoles(courseRoles, user, courseId)) {
      return true;
    }
    // then check if they have the right org role
    if (await this.matchOrgRoles(orgRoles, user, courseId)) {
      return true;
    }
    // if they don't have either, throw an error
    throw new ForbiddenException(
      ERROR_MESSAGES.roleGuard.mustBeRoleToAccessExtended(
        courseRoles,
        orgRoles,
      ),
    );
  }

  async setupData(request: any): Promise<{ user: UserModel }> {
    const user = await UserModel.findOne(request.user.userId, {
      relations: ['organizationUser', 'courses'],
    });

    return { user };
  }

  matchCourseRoles(
    roles: string[],
    user: UserModel,
    courseId: number,
  ): boolean {
    const userCourse = user.courses.find((course) => {
      return Number(course.courseId) === Number(courseId);
    });
    if (!userCourse) {
      return false;
    }

    const hasCorrectRole = roles.includes(userCourse.role);

    return hasCorrectRole;
  }

  async matchOrgRoles(
    roles: string[],
    user: UserModel,
    courseId: number,
  ): Promise<boolean> {
    const userOrg = user.organizationUser;
    if (!userOrg) {
      throw new ForbiddenException('This user is not in any organization');
    }

    const hasCorrectRole = roles.includes(userOrg.role);
    if (!hasCorrectRole) {
      return false;
    }

    // make sure this org user is in the same org as the course (that way org profs in one course can't access courses in another org)
    try {
      await OrganizationCourseModel.findOneOrFail({
        where: {
          organizationId: userOrg.organizationId,
          courseId,
        },
      });
    } catch (e) {
      throw new NotFoundException(
        'This course does not exist in your organization',
      );
    }

    return true;
  }
}
