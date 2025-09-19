import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IdToken } from 'lti-typescript';

@Injectable()
export class LtiGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const response = context.switchToHttp().getResponse();
    const { token } = await this.setupData(response);

    return this.hasAuthorization(token);
  }

  async setupData(response: any): Promise<{ token: IdToken }> {
    const token = response.locals['token'];

    return {
      token,
    };
  }

  async hasAuthorization(token: IdToken): Promise<boolean> {
    return !!token;
  }
}
