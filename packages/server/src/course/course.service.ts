import {
  ERROR_MESSAGES,
  TACheckinPair,
  TACheckinTimesResponse,
  Role,
  EditCourseInfoParams,
  GetCourseUserInfoResponse,
  UserPartial,
} from '@koh/common';
import {
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { partition } from 'lodash';
import { EventModel, EventType } from 'profile/event-model.entity';
import { QuestionModel } from 'question/question.entity';
import { Between, In } from 'typeorm';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { CourseModel } from './course.entity';
import { UserModel } from 'profile/user.entity';
import { QueueInviteModel } from 'queue/queue-invite.entity';
import { UnreadAsyncQuestionModel } from 'asyncQuestion/unread-async-question.entity';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { CourseSettingsModel } from './course_settings.entity';

export type CourseCloneAttributes = {
  cloneAttributes: {
    name?: boolean;
    sectionGroupName?: boolean;
    coordinator_email?: boolean;
    icalURL?: boolean;
    zoomLink?: boolean;
    questionTimer?: boolean;
    enabled?: boolean;
    timezone?: boolean;
    courseInviteCode?: boolean;
    asyncQuestionDisplayTypes?: boolean;
  };
  cloneCourseSettings: {
    chatBotEnabled?: boolean;
    asyncQueueEnabled?: boolean;
    adsEnabled?: boolean;
    queueEnabled?: boolean;
    scheduleOnFrontPage?: boolean;
    asyncCentreAIAnswers?: boolean;
  };
};

@Injectable()
export class CourseService {
  constructor(private readonly redisProfileService: RedisProfileService) {}

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
          EventType.TA_CHECKED_OUT_EVENT_END,
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
      await UnreadAsyncQuestionModel.delete({
        userId: userCourse.userId,
        courseId: userCourse.courseId,
      });
      await this.redisProfileService.deleteProfile(`u:${userCourse.userId}`);
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
    roles?: Role[],
  ): Promise<GetCourseUserInfoResponse> {
    // these are the params the query will use
    const params: any[] = [courseId, pageSize, (page - 1) * pageSize];

    // check if searching for specific role and ensure it is a valid role
    let roleCondition = '';
    if (roles && roles.length > 0) {
      if (roles.some((role) => !Object.values(Role).includes(role))) {
        throw new BadRequestException(
          ERROR_MESSAGES.courseController.roleInvalid,
        );
      }
      roleCondition = `AND user_course_model.role::text = ANY($4::text[])`;
      params.push(roles);
    }

    // check if searching for specific name
    let searchCondition = '';
    if (search) {
      const searchString = search.replace(' ', '').toUpperCase();
      searchCondition = `
        AND CONCAT(UPPER(user_model."firstName"), UPPER(user_model."lastName"))
          LIKE '%' || ${roleCondition ? '$5' : '$4'} || '%'
      `;
      params.push(searchString);
    }

    const query = `
      SELECT user_model.id, user_model."firstName" || ' ' || user_model."lastName" AS name, user_model."photoURL", user_model.email, user_model.sid, user_course_model."TANotes", COUNT(*) OVER () AS total
      FROM user_course_model
      INNER JOIN user_model ON user_model.id = user_course_model."userId"
      WHERE user_course_model."courseId" = $1
        ${roleCondition}
        ${searchCondition}
      ORDER BY user_model."firstName", user_model."lastName"
      LIMIT $2
      OFFSET $3
    `;

    // make the query
    const rawUsers = (await UserCourseModel.query(
      query,
      params,
    )) as UserPartial &
      {
        total: number;
      }[];

    const total = rawUsers.length > 0 ? Number(rawUsers[0].total) : 0;

    // strip out the total from the rawUsers (not a huge performance hit since n is always going to be <= 50, and adding another DB query for count would be much more expensive)
    const users: UserPartial[] = rawUsers.map(
      ({ total, ...rest }) => ({ ...rest }) as UserPartial,
    );

    return { users, total };
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

      await this.redisProfileService.deleteProfile(`u:${user.id}`);

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

  async cloneCourse(
    courseId: number,
    cloneData: CourseCloneAttributes,
  ): Promise<void> {
    const originalCourse = await CourseModel.findOne(courseId, {
      relations: ['courseSettings'],
    });
    if (!originalCourse) {
      throw new NotFoundException(`Course with id ${courseId} not found`);
    }

    // Create a new course instance and apply the selected clones
    const clonedCourse = new CourseModel();

    if (cloneData.cloneAttributes?.name) {
      clonedCourse.name = originalCourse.name;
    }

    if (cloneData.cloneAttributes?.sectionGroupName) {
      clonedCourse.sectionGroupName = originalCourse.sectionGroupName;
    }
    if (cloneData.cloneAttributes?.coordinator_email) {
      clonedCourse.coordinator_email = originalCourse.coordinator_email;
    }
    if (cloneData.cloneAttributes?.icalURL) {
      clonedCourse.icalURL = originalCourse.icalURL;
    }
    if (cloneData.cloneAttributes?.zoomLink) {
      clonedCourse.zoomLink = originalCourse.zoomLink;
    }
    if (cloneData.cloneAttributes?.questionTimer) {
      clonedCourse.questionTimer = originalCourse.questionTimer;
    }
    if (cloneData.cloneAttributes?.enabled) {
      clonedCourse.enabled = originalCourse.enabled;
    }
    if (cloneData.cloneAttributes?.timezone) {
      clonedCourse.timezone = originalCourse.timezone;
    }
    if (cloneData.cloneAttributes?.courseInviteCode) {
      clonedCourse.courseInviteCode = originalCourse.courseInviteCode;
    }
    if (cloneData.cloneAttributes?.asyncQuestionDisplayTypes) {
      clonedCourse.asyncQuestionDisplayTypes =
        originalCourse.asyncQuestionDisplayTypes;
    }
    // ...clone other required course fields as needed...

    await clonedCourse.save();

    // Clone course settings if checklist flags are provided and settings exist
    if (originalCourse.courseSettings) {
      const origSettings = originalCourse.courseSettings;
      const clonedSettings = new CourseSettingsModel();
      clonedSettings.courseId = clonedCourse.id;
      if (cloneData.cloneCourseSettings?.chatBotEnabled) {
        clonedSettings.chatBotEnabled = origSettings.chatBotEnabled;
      }
      if (cloneData.cloneCourseSettings?.asyncQueueEnabled) {
        clonedSettings.asyncQueueEnabled = origSettings.asyncQueueEnabled;
      }
      if (cloneData.cloneCourseSettings?.adsEnabled) {
        clonedSettings.adsEnabled = origSettings.adsEnabled;
      }
      if (cloneData.cloneCourseSettings?.queueEnabled) {
        clonedSettings.queueEnabled = origSettings.queueEnabled;
      }
      if (cloneData.cloneCourseSettings?.scheduleOnFrontPage) {
        clonedSettings.scheduleOnFrontPage = origSettings.scheduleOnFrontPage;
      }
      if (cloneData.cloneCourseSettings?.asyncCentreAIAnswers) {
        clonedSettings.asyncCentreAIAnswers = origSettings.asyncCentreAIAnswers;
      }
      await clonedSettings.save();
    }
  }
}
