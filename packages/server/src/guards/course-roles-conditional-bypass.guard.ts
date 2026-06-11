import { Injectable } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';
import { Role, SuperCoursePurpose } from '@koh/common';
import { SuperCourseModel } from '../course/super-course.entity';

/* Functionally the same as CourseRolesGuard, but allows specific
conditional chatbot access paths that do not have normal course membership. */
@Injectable()
export class CourseRolesConditionalBypassGuard extends RolesGuard {
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
      const superCourse = await SuperCourseModel.createQueryBuilder(
        'superCourse',
      )
        .innerJoin('superCourse.courses', 'matchedCourse')
        .leftJoinAndSelect('superCourse.courses', 'courses')
        .where('superCourse.purpose = :purpose', {
          purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        })
        .andWhere('matchedCourse.id = :courseId', {
          courseId: Number(courseId),
        })
        .getOne();
      const requestedCourse = superCourse?.courses.find(
        (groupCourse) => Number(groupCourse.id) === Number(courseId),
      );
      if (requestedCourse?.chatbotAgentName) {
        const parentMembership = user.courses.find((userCourse) =>
          superCourse.courses.some(
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
