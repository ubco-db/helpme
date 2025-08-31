import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { IdToken, Provider } from 'lti-typescript';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { ERROR_MESSAGES } from '@koh/common';
import { LoginController } from '../login/login.controller';
import { JwtService } from '@nestjs/jwt';
import express from 'express';
import { ConfigService } from '@nestjs/config';

const restrictPaths = [
  /^\/api\/v1\/courses\/[0-9]+(\/features)?$/,
  /^\/api\/v1\/profile$/,
  /^\/api\/v1\/chatbot\/question\/suggested\/[0-9]+$/,
  /^\/api\/v1\/chatbot\/ask\/[0-9]+$/,
  /^\/api\/v1\/chatbot\/askSuggested\/[0-9]+$/,
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

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

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

  async generateAuthToken(userId: number) {
    // Expires in 10 minutes
    return await LoginController.generateAuthToken(
      userId,
      this.jwtService,
      60 * 10,
      restrictPaths,
    );
  }

  async attachAuthToken(userId: number, res: express.Response) {
    const authToken = await this.generateAuthToken(userId);

    const isSecure = this.configService
      .get<string>('DOMAIN')
      .startsWith('https://');

    res.cookie('auth-token', authToken, { httpOnly: true, secure: isSecure });
    return res;
  }

  private static extractCourseId(connection: IdToken) {
    switch (connection.platformInfo.name) {
      case 'canvas':
        return connection.platformContext.custom?.canvas_course_id;
      default:
        return undefined;
    }
  }
}
