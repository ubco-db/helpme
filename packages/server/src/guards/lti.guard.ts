import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IdToken } from 'lti-typescript';
import { UserModel } from '../profile/user.entity';

@Injectable()
export class LtiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    const { userId, token } = await this.setupData(response);

    return this.hasAuthorization(userId, token);
  }

  async setupData(response: any): Promise<{ userId: number; token: IdToken }> {
    const userId = response.locals['userId'];
    const token = response.locals['token'];

    return {
      userId,
      token,
    };
  }

  async hasAuthorization(userId: number, token: IdToken): Promise<boolean> {
    if (!userId || !token) {
      return false;
    }

    const user = await UserModel.findOne({
      where: { id: userId },
    });

    return !!user;
  }
}
