import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IdToken } from 'lti-typescript';
import { UserCourseModel } from '../profile/user-course.entity';

@Injectable()
export class LtiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    const { ucid, token } = await this.setupData(response);

    return this.hasAuthorization(ucid, token);
  }

  async setupData(response: any): Promise<{ ucid: number; token: IdToken }> {
    const ucid = response.locals['ucid'];
    const token = response.locals['token'];

    return {
      ucid,
      token,
    };
  }

  async hasAuthorization(ucid: number, token: IdToken): Promise<boolean> {
    if (ucid === undefined || ucid === null || !token) {
      return false;
    }

    const userCourse = await UserCourseModel.findOne({
      where: { id: ucid },
    });

    return !!userCourse;
  }
}
