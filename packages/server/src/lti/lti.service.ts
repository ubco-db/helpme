import { Injectable, NotFoundException } from '@nestjs/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { IdToken, Provider } from 'lti-typescript';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { ERROR_MESSAGES } from '@koh/common';
import { LoginController } from '../login/login.controller';
import { JwtService } from '@nestjs/jwt';
import express from 'express';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';

// LTI Tool can only access the following API routes

export const restrictPaths = [
  'r^\\/lti.*$',
  'r^\\/api\\/v1\\/courses\\/[0-9]+(\\/features)?$',
  'r^\\/api\\/v1\\/profile$',
  'r^\\/api\\/v1\\/chatbot\\/question\\/suggested\\/[0-9]+$',
  'r^\\/api\\/v1\\/semesters\\/[0-9]+$',
  'r^\\/api\\/v1\\/chatbot\\/ask\\/[0-9]+$',
  'r^\\/api\\/v1\\/chatbot\\/askSuggested\\/[0-9]+$',
  'r^\\/api\\/v1\\/lms.*$',
];

@Injectable()
export class LtiService {
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

  constructor(private jwtService: JwtService) {}

  static async findMatchingUserAndCourse(
    token: IdToken,
  ): Promise<{ userId: number; courseId?: number }> {
    const domain = token.iss.replace(/http(s?):\/\//, '');
    const organizationMatch: LMSOrganizationIntegrationModel =
      await LMSOrganizationIntegrationModel.createQueryBuilder(
        'org_integration',
      )
        .select()
        .where('org_integration.rootUrl LIKE :url', { url: domain })
        .getOne();

    let matchingUsers = await UserModel.find({
      where: { email: token.userInfo.email },
      relations: {
        organizationUser: true,
      },
    });

    if (organizationMatch) {
      matchingUsers = matchingUsers.filter(
        (u) =>
          u.organizationUser.organizationId == organizationMatch.organizationId,
      );
    }

    if (matchingUsers.length <= 0) {
      throw new NotFoundException(ERROR_MESSAGES.ltiService.noMatchingUser);
    }
    const matchingUserIds = matchingUsers.map((u) => u.id);
    let userId: number = matchingUserIds[0];
    let courseId: number | undefined = undefined;

    if (matchingUserIds.length > 0) {
      const platformCourseId = LtiService.extractCourseId(token);
      if (platformCourseId != undefined) {
        const lmsCourseIntegration = await LMSCourseIntegrationModel.findOne({
          where: {
            apiCourseId: platformCourseId,
          },
        });
        if (lmsCourseIntegration) {
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
            userId = userCourse.userId;
            courseId = userCourse.courseId;
            break;
          }
        }
      }
    }

    return {
      userId,
      courseId,
    };
  }

  async generateAuthToken(userId: number) {
    // Expires in 10 minutes
    return await LoginController.generateAuthToken(
      userId,
      this.jwtService,
      60 * 10,
      restrictPaths,
    );
  }

  async attachAuthToken(userId: number, res: express.Response, token?: string) {
    const authToken = token ?? (await this.generateAuthToken(userId));

    res.clearCookie('auth_token');
    res.cookie('auth_token', authToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
    });

    return res;
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
