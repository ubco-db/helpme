import { Injectable } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';
import { Role } from '@koh/common';
import { CourseModel } from '../course/course.entity';

/* Functionally the same as CourseRolesGuard but will allow users 
to access the course with id HELPME_COURSE_ID as a student */
@Injectable()
export class CourseRolesBypassHelpMeCourseGuard extends RolesGuard {
  async setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }> {
    const user: any = await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
      relations: {
        courses: true,
      },
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

    // Agent courses are hidden from students, but students enrolled in the
    // non-agent parent course should still be able to ask those agent chatbots.
    if (!user?.courses?.find((c) => Number(c.courseId) === Number(courseId))) {
      const agentCourse = await CourseModel.findOne({
        where: { id: Number(courseId) },
        relations: { superCourse: { courses: true } },
      });
      if (agentCourse?.superCourse?.purpose === 'chatbot_agent_group') {
        const parentMembership = user.courses.find((userCourse) =>
          agentCourse.superCourse.courses.some(
            (groupCourse) =>
              Number(groupCourse.id) === Number(userCourse.courseId) &&
              !groupCourse.chatbotAgentName,
          ),
        );
        if (parentMembership) {
          user.courses.push({
            courseId,
            role: parentMembership.role,
          });
        }
      }
    }
    return { courseId, user };
  }
}
