import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { IdToken, Provider } from 'lti-typescript';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { ERROR_MESSAGES, Role } from '@koh/common';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions } from 'express';
import { LtiCourseInviteModel } from './lti-course-invite.entity';
import * as crypto from 'crypto';

@Injectable()
export class LtiService {
  static readonly cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  };
  constructor(private jwtService: JwtService) {}

  private _provider: Provider | undefined;
  get provider(): Provider {
    if (!this._provider) {
      throw new Error('LTI Provider not initialized!');
    }
    return this._provider;
  }
  set provider(provider: Provider) {
    this._provider = provider;
  }

  async createCourseInvite(courseId: number, email: string): Promise<string> {
    let inviteCode: string;
    do {
      inviteCode = crypto.randomBytes(64).toString('hex');
    } while (
      await LtiCourseInviteModel.findOne({ where: { inviteCode, courseId } })
    );

    await LtiCourseInviteModel.create({
      courseId,
      inviteCode,
      email,
    }).save();

    const token = this.jwtService.sign({
      courseId,
      inviteCode,
    });

    if (!token) {
      throw new BadRequestException(ERROR_MESSAGES.ltiService.errorSigningJwt);
    }

    return token;
  }

  async checkCourseInvite(userId: number, code: string) {
    const token = this.jwtService.decode<{
      courseId: number;
      inviteCode: string;
    }>(code);

    if (
      !token ||
      !token.courseId ||
      isNaN(token.courseId) ||
      !token.inviteCode
    ) {
      throw new BadRequestException(ERROR_MESSAGES.ltiService.invalidInviteJwt);
    }

    const { courseId, inviteCode } = token;

    const user = await UserModel.findOne({
      where: {
        id: userId,
      },
      relations: {
        organizationUser: true,
      },
    });

    const matchingInvite = await LtiCourseInviteModel.findOne({
      where: {
        inviteCode,
        courseId,
      },
      relations: {
        course: {
          organizationCourse: true,
        },
      },
    });

    if (!matchingInvite) {
      throw new NotFoundException(
        ERROR_MESSAGES.ltiService.courseInviteNotFound,
      );
    }

    if (matchingInvite.email != user.email) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiService.courseInviteEmailMismatch,
      );
    }

    if (
      user.organizationUser.organizationId !=
      matchingInvite.course.organizationCourse.organizationId
    ) {
      throw new NotFoundException(
        ERROR_MESSAGES.ltiService.courseInviteOrganizationMismatch,
      );
    }

    if (
      matchingInvite.expires != undefined &&
      (Date.now() - matchingInvite.createdAt.getTime()) / 1000 >
        matchingInvite.expires
    ) {
      await matchingInvite.remove();
      throw new BadRequestException(
        ERROR_MESSAGES.ltiService.courseInviteExpired,
      );
    }

    const enrollment = await UserCourseModel.findOne({
      where: {
        userId,
        courseId: courseId,
      },
    });

    // Delete any invites for this course for this email
    await LtiCourseInviteModel.delete({
      email: user.email,
      courseId,
    });

    if (!enrollment) {
      await UserCourseModel.create({
        userId,
        courseId: courseId,
        role: Role.STUDENT,
      }).save();
    }

    return courseId;
  }

  static async findMatchingUserAndCourse(
    token: IdToken,
  ): Promise<{ userId?: number; courseId?: number }> {
    let userId: number | undefined;
    let courseId: number | undefined = undefined;

    const matchingUsers = await UserModel.find({
      where: { email: token.userInfo.email },
      relations: {
        organizationUser: true,
      },
    });

    let lmsCourseIntegration: LMSCourseIntegrationModel;

    const platformCourseId = LtiService.extractCourseId(token);
    if (platformCourseId != undefined) {
      lmsCourseIntegration = await LMSCourseIntegrationModel.findOne({
        where: {
          apiCourseId: platformCourseId,
        },
        relations: {
          orgIntegration: true,
        },
      });
      courseId = lmsCourseIntegration?.courseId;
    }

    const matchingUserIds = matchingUsers.map((u) => u.id);
    userId = matchingUserIds[0];

    if (matchingUserIds.length > 0 && courseId != undefined) {
      for (const matchingUserId of matchingUserIds) {
        const userCourse = await UserCourseModel.findOne({
          where: {
            userId: matchingUserId,
            courseId,
          },
        });
        if (!userCourse) {
          continue;
        }
        userId = userCourse.userId;
        break;
      }
    }

    return {
      userId,
      courseId,
    };
  }

  static extractCourseId(token: IdToken) {
    switch (token.platformInfo.product_family_code) {
      case 'canvas':
        return token.platformContext.custom?.canvas_course_id;
      default:
        return undefined;
    }
  }
}
