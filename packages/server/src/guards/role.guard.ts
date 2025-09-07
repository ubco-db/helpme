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
import { UserModel } from '../profile/user.entity';
import * as Sentry from '@sentry/browser';

/**
 * This is an abstract guard that gets extended by other guards (e.g. CourseRolesGuard and QueueRolesGuard)
 * to ensure that the user has the correct role (provided by the `@Roles` decorator) to access a certain route.
 * Since it is abstract, it is not meant to be used as a standalone guard.
 * This will throw errors if the user is not logged in, not in the course, or does not have the correct role.
 *
 * Please make sure that 'user' argument also has the 'courses' relation loaded otherwise matchRoles will not work.
 */
@Injectable()
export abstract class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      // if it doesn't have the roles decorator, maybe it has the CourseRoles decorator?
      roles = this.reflector.get<string[]>('CourseRoles', context.getHandler());
      if (!roles) {
        Sentry.captureException(
          new NotImplementedException(
            `${context.getHandler().name} is missing the @Roles decorator (and thus any RolesGuard will not work and this endpoint returns 501).`,
          ),
        );
        throw new NotImplementedException(
          'This endpoint is missing the @Roles decorator (and thus any RolesGuard will not work). Please notify a developer and we will fix it as soon as we can.',
        );
      }
    }
    const request = context.switchToHttp().getRequest();
    const { courseId, user } = await this.setupData(request);

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.roleGuard.notLoggedIn);
    }

    if (!courseId) {
      throw new NotFoundException(ERROR_MESSAGES.roleGuard.noCourseIdFound);
    }

    return this.matchRoles(roles, user, courseId);
  }

  matchRoles(roles: string[], user: UserModel, courseId: number): boolean {
    const userCourse = user.courses.find((course) => {
      return Number(course.courseId) === Number(courseId);
    });

    if (!userCourse || !userCourse.role) {
      throw new NotFoundException(ERROR_MESSAGES.roleGuard.notInCourse);
    }

    const remaining = roles.filter((role) => {
      return userCourse.role.toString() === role;
    });

    if (remaining.length <= 0) {
      throw new ForbiddenException(
        ERROR_MESSAGES.roleGuard.mustBeRoleToAccess(roles),
      );
    }

    return remaining.length > 0;
  }

  // You implement this with a child class so that it provides a courseId and user (and user must have the courses relation loaded!)
  abstract setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }>;
}
