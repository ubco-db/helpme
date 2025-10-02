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
import { UserLtiIdentityModel } from './user_lti_identity.entity';
import { LtiIdentityTokenModel } from './lti_identity_token.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LMSAuthStateModel } from '../lmsIntegration/lms-auth-state.entity';
import { pick } from 'lodash';
import { Not } from 'typeorm';

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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'CLEAR_LTI_TOKENS' })
  async clearLtiTokens() {
    await LMSAuthStateModel.createQueryBuilder()
      .delete()
      .where(
        `(EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM lti_identity_token_model."createdAt")) > lti_identity_token_model."expiresIn"`,
      )
      .execute();
    await LMSAuthStateModel.createQueryBuilder()
      .delete()
      .where(
        `(EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM lti_course_invite_model."createdAt")) > lti_course_invite_model."expiresIn"`,
      )
      .execute();
  }

  async createLtiIdentityToken(
    issuer: string,
    ltiUserId: string,
    ltiEmail?: string,
  ): Promise<string> {
    let code: string;
    do {
      code = crypto.randomBytes(64).toString('hex');
    } while (await LtiIdentityTokenModel.findOne({ where: { code } }));

    await LtiIdentityTokenModel.delete({
      issuer,
      ltiUserId,
    });

    await LtiIdentityTokenModel.create({
      code,
      issuer,
      ltiUserId,
      ltiEmail,
    }).save();

    const token = this.jwtService.sign({
      code,
    });

    if (!token) {
      throw new BadRequestException(ERROR_MESSAGES.ltiService.errorSigningJwt);
    }

    return token;
  }

  async checkLtiIdentityToken(
    userId: number,
    signedToken: string,
  ): Promise<boolean> {
    const token = this.jwtService.decode<{
      code: string;
    }>(signedToken);

    if (!token || !token.code) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiService.invalidIdentityJwt,
      );
    }

    const { code } = token;

    const matchingToken = await LtiIdentityTokenModel.findOne({
      where: {
        code,
      },
    });

    if (!matchingToken) {
      return false;
    }

    if (
      matchingToken.expires != undefined &&
      (Date.now() - matchingToken.createdAt.getTime()) / 1000 >
        matchingToken.expires
    ) {
      await matchingToken.remove();
      return false;
    }

    // If user has logged in with a different account prior, remove the identity entry for that account for
    // this ISS + user ID combo
    await UserLtiIdentityModel.delete({
      userId: Not(userId),
      issuer: matchingToken.issuer,
      ltiUserId: matchingToken.ltiUserId,
    });

    await UserLtiIdentityModel.create({
      userId,
      ...pick(matchingToken, ['issuer', 'ltiEmail', 'ltiUserId']),
    }).save();

    // The matching token is not removed as it may be re-used later
    // await matchingToken.remove();

    return true;
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

    const matchingUsers = await UserModel.createQueryBuilder('user_model')
      .select()
      .leftJoinAndSelect(
        UserLtiIdentityModel,
        'lti_user',
        'lti_user."userId" = user_model.id AND lti_user.issuer = :issuer AND lti_user."ltiUserId" = :ltiUserId',
        {
          issuer: token.iss,
          ltiUserId: token.user,
        },
      )
      .where('email = :email', {
        email: token.userInfo.email,
      })
      .orWhere('lti_user."userId" IS NOT NULL')
      .orderBy('lti_user."userId"', 'ASC', 'NULLS LAST')
      .getMany();

    let lmsCourseIntegration: LMSCourseIntegrationModel;

    const platformCourseId = LtiService.extractCourseId(token);
    if (platformCourseId != undefined) {
      lmsCourseIntegration = await LMSCourseIntegrationModel.findOne({
        where: {
          apiCourseId: platformCourseId,
        },
      });
      courseId = lmsCourseIntegration?.courseId;
    }

    const matchingUserIds = matchingUsers.map((u) => u.id);
    userId = matchingUserIds[0];

    // We only need to narrow it down if there's > 1
    if (matchingUserIds.length > 1 && courseId != undefined) {
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

    // Refresh identity in case it's changed and the user was found
    if (userId != undefined) {
      // If user has logged in with a different account prior, remove the identity entry for that account for
      // this ISS + user ID combo
      await UserLtiIdentityModel.delete({
        userId: Not(userId),
        issuer: token.iss,
        ltiUserId: token.user,
      });

      await UserLtiIdentityModel.create({
        userId,
        issuer: token.iss,
        ltiEmail: token.userInfo.email,
        ltiUserId: token.user,
      }).save();
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
