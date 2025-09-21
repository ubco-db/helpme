import { ERROR_MESSAGES } from '@koh/common';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { In } from 'typeorm';

/* The user must have one of the specified CourseRoles OR OrgRoles in order to access this endpoint.
    This could be used if there was an endpoint you want the course professor to be able to use or the org admin.
    Note that you DO need a courseId or cid parameter.
    You do NOT need an orgId or oid parameter, as the org is determined by the course.

    ALSO NOTE: if you pass in OrgRole(PROFESSOR), you are allowing ANY user with the org role of professor to access the endpoint, regardless of whether or not they are in the course
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

    const courseId =
      request.params.courseId ??
      request.params.cid ??
      Number(request.body?.[0]) ?? // if the body is an array of a single courseId, it will use that (used in deleteUserCourses()). In the case that an admin is withdrawing a user from multiple courses, it will still work since the hasOrgRole check will be true
      null;
    const userId = request.user.userId ?? null;

    if (!userId) {
      throw new UnauthorizedException('User not logged in');
    }
    if (!courseId) {
      throw new NotFoundException(ERROR_MESSAGES.roleGuard.noCourseIdFound);
    }

    const [hasCourseRole, hasOrgRole] = await Promise.all([
      this.matchCourseRoles(courseRoles, userId, courseId),
      this.matchOrgRoles(orgRoles, userId, courseId),
    ]);
    if (!hasCourseRole && !hasOrgRole) {
      // if they don't have either, throw an error
      throw new ForbiddenException(
        ERROR_MESSAGES.roleGuard.mustBeRoleToAccessExtended(
          courseRoles,
          orgRoles,
        ),
      );
    }
    return true;
  }

  /* Returns false if the course does not exist, if they are not in the course, or if they have the wrong role.
  This is because ultimately I opted for having better performance with having less queries with the tradeoff of less-granular error messages.
  Same mantra goes for matchOrgRoles
  */
  async matchCourseRoles(
    roles: string[],
    userId: number,
    courseId: number,
  ): Promise<boolean> {
    try {
      await UserCourseModel.findOneOrFail({
        where: {
          userId: userId,
          courseId,
          role: In(roles),
        },
      });
    } catch (e) {
      return false;
    }
    return true;
  }

  async matchOrgRoles(
    roles: string[],
    userId: number,
    courseId: number,
  ): Promise<boolean> {
    // make sure this org user is in the same org as the course (that way org profs in one course can't access courses in another org)
    // use query builder to inner join OrganizationCourse with OrganizationUser (that way the it checks if the course is in the same org as the user)
    const orgCourseUser = await OrganizationCourseModel.createQueryBuilder('oc')
      .innerJoin(
        OrganizationUserModel,
        'ou',
        `oc."organizationId" = ou."organizationId"`,
      )
      .select([
        'oc.id as "oc_id"',
        'oc.organizationId as "oc_organizationId"',
        'oc.courseId as "oc_courseId"',
        'ou.id as "ou_id"',
        'ou.role as "ou_role"',
      ])
      .where('ou."userId" = :userId', { userId })
      .andWhere('oc."courseId" = :courseId', { courseId })
      .getRawOne<{
        oc_id: number;
        oc_organizationId: number;
        oc_courseId: number;
        ou_id: number;
        ou_role: string;
      }>();

    if (!orgCourseUser) {
      return false;
    }

    // then check if the user has the right org roles
    if (!roles.includes(orgCourseUser.ou_role)) {
      return false;
    }

    return true;
  }
}
