import {
  ERROR_MESSAGES,
  TACheckinPair,
  TACheckinTimesResponse,
  Role,
  EditCourseInfoParams,
  GetCourseUserInfoResponse,
} from '@koh/common';
import {
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { partition } from 'lodash';
import { EventModel, EventType } from 'profile/event-model.entity';
import { QuestionModel } from 'question/question.entity';
import { Between, Brackets, getRepository, In } from 'typeorm';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { CourseModel } from './course.entity';
import { UserModel } from 'profile/user.entity';
import { QueueInviteModel } from 'queue/queue-invite.entity';

@Injectable()
export class CourseService {
  async getTACheckInCheckOutTimes(
    courseId: number,
    startDate: string,
    endDate: string,
  ): Promise<TACheckinTimesResponse> {
    const startDateAsDate = new Date(startDate);
    const endDateAsDate = new Date(endDate);
    if (startDateAsDate.getUTCDate() === endDateAsDate.getUTCDate()) {
      endDateAsDate.setUTCDate(endDateAsDate.getUTCDate() + 1);
    }

    const taEvents = await EventModel.find({
      where: {
        eventType: In([
          EventType.TA_CHECKED_IN,
          EventType.TA_CHECKED_OUT,
          EventType.TA_CHECKED_OUT_FORCED,
        ]),
        time: Between(startDateAsDate, endDateAsDate),
        courseId,
      },
      relations: ['user'],
    });

    const [checkinEvents, otherEvents] = partition(
      taEvents,
      (e) => e.eventType === EventType.TA_CHECKED_IN,
    );

    const taCheckinTimes: TACheckinPair[] = [];

    for (const checkinEvent of checkinEvents) {
      let closestEvent: EventModel = null;
      let mostRecentTime = new Date();
      const originalDate = mostRecentTime;

      for (const checkoutEvent of otherEvents) {
        if (
          checkoutEvent.userId === checkinEvent.userId &&
          checkoutEvent.time > checkinEvent.time &&
          checkoutEvent.time.getTime() - checkinEvent.time.getTime() <
            mostRecentTime.getTime() - checkinEvent.time.getTime()
        ) {
          closestEvent = checkoutEvent;
          mostRecentTime = checkoutEvent.time;
        }
      }

      const numHelped = await QuestionModel.count({
        where: {
          taHelpedId: checkinEvent.userId,
          helpedAt: Between(
            checkinEvent.time,
            closestEvent?.time || new Date(),
          ),
        },
      });

      taCheckinTimes.push({
        name: checkinEvent.user.name,
        checkinTime: checkinEvent.time,
        checkoutTime: closestEvent?.time,
        inProgress: mostRecentTime === originalDate,
        forced: closestEvent?.eventType === EventType.TA_CHECKED_OUT_FORCED,
        numHelped,
      });
    }

    return { taCheckinTimes };
  }

  async removeUserFromCourse(userCourse: UserCourseModel): Promise<void> {
    if (!userCourse) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      await UserCourseModel.remove(userCourse);
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.removeCourse,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async editCourse(
    courseId: number,
    coursePatch: EditCourseInfoParams,
  ): Promise<void> {
    const course = await CourseModel.findOne(courseId);
    if (course === null || course === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // Destructure coursePatch to separate courseInviteCode from other fields
    const { courseInviteCode, ...otherFields } = coursePatch;
    // Allow courseInviteCode to be null or empty but no other fields
    if (Object.values(otherFields).some((x) => x === null || x === '')) {
      throw new BadRequestException(
        ERROR_MESSAGES.courseController.updateCourse,
      );
    }

    for (const crn of new Set(coursePatch.crns)) {
      const courseCrnMaps = await CourseSectionMappingModel.find({
        crn: crn,
      });

      let courseCrnMapExists = false;

      for (const courseCrnMap of courseCrnMaps) {
        const conflictCourse = await CourseModel.findOne(courseCrnMap.courseId);
        if (conflictCourse && conflictCourse.semesterId === course.semesterId) {
          if (courseCrnMap.courseId !== courseId) {
            throw new BadRequestException(
              ERROR_MESSAGES.courseController.crnAlreadyRegistered(
                crn,
                courseId,
              ),
            );
          } else {
            courseCrnMapExists = true;
            break;
          }
        }
      }

      if (!courseCrnMapExists) {
        try {
          await CourseSectionMappingModel.create({
            crn: crn,
            courseId: course.id,
          }).save();
        } catch (err) {
          console.error(err);
          throw new HttpException(
            ERROR_MESSAGES.courseController.createCourseMappings,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
    }

    if (coursePatch.name) {
      course.name = coursePatch.name;
    }

    if (coursePatch.coordinator_email) {
      course.coordinator_email = coursePatch.coordinator_email;
    }

    if (coursePatch.icalURL) {
      course.icalURL = coursePatch.icalURL;
    }

    if (coursePatch.zoomLink) {
      course.zoomLink = coursePatch.zoomLink;
    }
    if (coursePatch.questionTimer) {
      course.questionTimer = coursePatch.questionTimer;
    }

    if (coursePatch.timezone) {
      course.timezone = coursePatch.timezone;
    }

    if (coursePatch.enabled) {
      course.enabled = coursePatch.enabled;
    }

    if (coursePatch.courseInviteCode !== undefined) {
      course.courseInviteCode = coursePatch.courseInviteCode;
    }

    if (coursePatch.asyncQuestionDisplayTypes) {
      course.asyncQuestionDisplayTypes = coursePatch.asyncQuestionDisplayTypes;
    }
    try {
      await course.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.updateCourse,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserInfo(
    courseId: number,
    page: number,
    pageSize: number,
    search?: string,
    role?: Role,
  ): Promise<GetCourseUserInfoResponse> {
    const query = await getRepository(UserModel)
      .createQueryBuilder()
      .leftJoin(
        UserCourseModel,
        'UserCourseModel',
        '"UserModel".id = "UserCourseModel"."userId"',
      )
      .where('"UserCourseModel"."courseId" = :courseId', { courseId });

    // check if searching for specific role and ensure it is a valid role
    if (role && Object.values(Role).includes(role)) {
      query.andWhere('"UserCourseModel".role = :role', { role });
    }
    // check if searching for specific name
    if (search) {
      const likeSearch = `%${search.replace(' ', '')}%`.toUpperCase();
      query.andWhere(
        new Brackets((q) => {
          q.where(
            'CONCAT(UPPER("UserModel"."firstName"), UPPER("UserModel"."lastName")) like :searchString',
            {
              searchString: likeSearch,
            },
          );
        }),
      );
    }

    // run query
    const users = query.select([
      'UserModel.id',
      'UserModel.firstName',
      'UserModel.lastName',
      'UserModel.photoURL',
      'UserModel.email',
      'UserModel.sid',
    ]);

    const total = await users.getCount();
    const usersSubset = await users
      .orderBy('UserModel.firstName')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { users: usersSubset, total };
  }

  async addStudentToCourse(
    course: CourseModel,
    user: UserModel,
  ): Promise<boolean> {
    try {
      const userInCourse = await UserCourseModel.findOne({
        where: { user: user, course: course },
      });

      if (userInCourse) {
        return false;
      }

      const userCourse = await UserCourseModel.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      }).save();

      const updatedUserCourse = user.courses;
      updatedUserCourse.push(userCourse);
      user.courses = updatedUserCourse;
      await user.save();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * There isn't really a good reason why this method is in course.service.ts other than it is close to addStudentToCourse. It would probably be better fitted in its own queue-invite.service.ts file but that is more effort than its worth
    This method return a redirect URL based on things.
    It will also enroll the user in the course if the queueInvite has willInviteToCourse set to true
  */
  async getQueueInviteRedirectURLandInviteToCourse(
    queueInviteCookie: string,
    userId: number,
  ): Promise<string> {
    const decodedCookie = decodeURIComponent(queueInviteCookie);
    const splitCookie = decodedCookie.split(',');
    const courseId = splitCookie[0];
    const queueId = splitCookie[1];
    const orgId = splitCookie[2];
    const courseInviteCode = Buffer.from(splitCookie[3], 'base64').toString(
      'utf-8',
    );
    // check if the queueInvite exists and if it will invite to course
    const queueInvite = await QueueInviteModel.findOne({
      where: { queueId },
    });
    // get the user to see if they are in the course
    const user = await UserModel.findOne({
      where: { id: userId },
      relations: ['courses'],
    });
    if (!user) {
      return '/login?error=notSuccessfullyLoggedIn';
    }
    const isUserInCourse = user.courses.some(
      (course) => course.courseId === Number(courseId),
    );
    if (isUserInCourse) {
      // if they're already in the course, just redirect them to the queue
      if (courseId && queueId) {
        return `/course/${courseId}/queue/${queueId}`;
      } else if (courseId) {
        return `/course/${courseId}`;
      } else {
        return '/courses';
      }
    } else if (!queueInvite) {
      // if the queueInvite doesn't exist
      return '/courses?err=inviteNotFound';
    } else if (queueInvite.willInviteToCourse && courseInviteCode) {
      // get course
      const course = await CourseModel.findOne({
        where: { id: courseId },
      });
      if (!course) {
        return '/courses?err=courseNotFound';
      }
      if (course.courseInviteCode !== courseInviteCode) {
        return '/courses?err=badCourseInviteCode';
      }
      await this.addStudentToCourse(course, user).catch((err) => {
        throw new BadRequestException(err.message);
      });
      if (courseId && queueId) {
        return `/course/${courseId}/queue/${queueId}`;
      } else if (courseId) return `/course/${courseId}`;
      else {
        return '/courses';
      }
    } else {
      return `/courses?err=notInCourse`;
    }
  }
}
