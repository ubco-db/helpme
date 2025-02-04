import {
  DesktopNotifPartial,
  ERROR_MESSAGES,
  KhouryProfCourse,
  QuestionStatusKeys,
  User,
} from '@koh/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  LastRegistrationModel,
  khourySemesterCodes,
} from 'login/last-registration-model.entity';
import { LoginCourseService } from 'login/login-course.service';
import { ProfSectionGroupsModel } from 'login/prof-section-groups.entity';
import { Connection } from 'typeorm';
import { UserModel } from './user.entity';
import { QuestionModel } from 'question/question.entity';
import { MailService } from 'mail/mail.service';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { pick } from 'lodash';
import { OrganizationService } from 'organization/organization.service';

@Injectable()
export class ProfileService {
  constructor(
    private redisProfileService: RedisProfileService,
    private organizationService: OrganizationService,
  ) {}

  async getProfile(user: UserModel): Promise<User> {
    const courses = user.courses
      ? user.courses
          .filter((userCourse) => userCourse?.course?.enabled)
          .map((userCourse) => {
            return {
              course: {
                id: userCourse.courseId,
                name: userCourse.course.name,
              },
              role: userCourse.role,
            };
          })
      : [];

    const desktopNotifs: DesktopNotifPartial[] = user.desktopNotifs
      ? user.desktopNotifs.map((d) => ({
          endpoint: d.endpoint,
          id: d.id,
          createdAt: d.createdAt,
          name: d.name,
        }))
      : [];

    const userResponse = pick(user, [
      'id',
      'email',
      'name',
      'sid',
      'firstName',
      'lastName',
      'photoURL',
      'defaultMessage',
      'includeDefaultMessage',
      'desktopNotifsEnabled',
      'insights',
      'userRole',
      'accountType',
      'emailVerified',
      'chat_token',
      'readChangeLog',
    ]);

    if (userResponse === null || userResponse === undefined) {
      console.error(ERROR_MESSAGES.profileController.userResponseNotFound);
      throw new HttpException(
        ERROR_MESSAGES.profileController.userResponseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // this is old code from Khoury College's semester system
    //const pendingCourses = await this.profileService.getPendingCourses(user.id);
    const userOrganization =
      await this.organizationService.getOrganizationAndRoleByUserId(user.id);

    const organization = pick(userOrganization, [
      'id',
      'orgId',
      'organizationName',
      'organizationDescription',
      'organizationLogoUrl',
      'organizationBannerUrl',
      'organizationRole',
    ]);

    const profile = {
      ...userResponse,
      courses,
      desktopNotifs,
      organization,
    };

    return profile;
  }
}
