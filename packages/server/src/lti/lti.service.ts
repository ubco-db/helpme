import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { IdToken } from 'lti-typescript';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { ERROR_MESSAGES } from '@koh/common';

@Injectable()
export class LtiService {
  constructor() {}

  async findMatchingUserCourse(connection: IdToken) {
    const matchingUserIds = (
      await UserModel.find({
        where: { email: connection.userInfo.email },
      })
    ).map((u) => u.id);

    let userCourseId: number | undefined = undefined;

    if (matchingUserIds.length > 0) {
      const platformCourseId = LtiService.extractCourseId(connection);
      if (platformCourseId === undefined) {
        throw new BadRequestException(
          ERROR_MESSAGES.ltiService.unparsableCourseId,
        );
      }
      const lmsCourseIntegration = await LMSCourseIntegrationModel.findOne({
        where: {
          apiCourseId: platformCourseId,
        },
      });
      if (!lmsCourseIntegration) {
        throw new NotFoundException(ERROR_MESSAGES.ltiService.noMatchCourse);
      }
      for (const matchingUserId of matchingUserIds) {
        const userCourse = await UserCourseModel.findOne({
          where: {
            userId: matchingUserId,
            courseId: lmsCourseIntegration.courseId,
          },
        });
        if (!userCourse) {
          continue;
        }
        userCourseId = userCourse.id;
        break;
      }
    }

    if (userCourseId == undefined) {
      throw new NotFoundException(ERROR_MESSAGES.ltiService.noMatchUserCourse);
    }

    return userCourseId;
  }

  private static extractCourseId(connection: IdToken) {
    switch (connection.platformInfo.name) {
      case 'canvas':
        return connection.platformInfo[
          'https://purl.imsglobal.org/spec/lti/claim/custom'
        ].canvas_course_id;
      default:
        return undefined;
    }
  }
}
