import { Injectable } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';
import { Role } from '@koh/common';

/* Functionally the same as CourseRolesGuard but will allow users 
to access the course with id HELPME_COURSE_ID as a student */
@Injectable()
export class CourseRolesBypassHelpMeCourseGuard extends RolesGuard {
  async setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }> {
    const user = await UserModel.findOne(request.user.userId, {
      relations: ['courses'],
    });
    const courseId =
      request.params.id ??
      request.params.courseId ??
      request.params.cid ??
      null;
    // if it's the helpme course, edit user's course to be a student inside the helpme course (only if they aren't already in the course)
    if (
      courseId === process.env.HELPME_COURSE_ID &&
      !user?.courses?.find((c) => c.courseId === courseId)
    ) {
      user.courses.push({
        courseId,
        role: Role.STUDENT,
      });
    }
    return { courseId, user };
  }
}
