import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import {
  AccountRegistrationParams,
  PasswordRequestResetBody,
  RegistrationTokenDetails,
} from '@koh/common';
import { LtiService } from './lti.service';
import { LoginService } from '../login/login.service';

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

@Controller('lti/auth')
export class LtiAuthController {
  constructor(
    private ltiService: LtiService,
    private authService: AuthService,
    private configService: ConfigService,
    private loginService: LoginService,
  ) {}

  @Get('shibboleth/:oid')
  async shibbolethAuth(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<any> {
    return await this.authService.shibbolethAuthCallback(
      req,
      res,
      organizationId,
      undefined,
      this.ltiService,
      {
        cookieName: 'lti_auth_token',
        prefix: '/lti',
        restrictPaths,
        redirect: '/lti',
        cookieOptions: LtiService.cookieOptions,
        expiresIn: 60 * 10,
      },
    );
  }

  @Get('link/:method/:oid')
  ssoAuth(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Response<{ redirectUri: string }> {
    return this.authService.ssoAuthInit(
      res,
      auth_method,
      organizationId,
      LtiService.cookieOptions,
      this.getAuthRedirectUri,
    );
  }

  @Post('registration/verify')
  @UseGuards(JwtAuthGuard)
  async validateRegistrationToken(
    @Res() res: Response,
    @Req() req: Request,
    @Body() registrationTokenDetails: RegistrationTokenDetails,
  ): Promise<Response<void>> {
    const result = await this.authService.verifyRegistrationToken(
      req,
      res,
      registrationTokenDetails,
    );

    // If non-number was returned, the verification failed
    if (typeof result != 'number') {
      return;
    }

    return (await this.loginService.handleCookies(
      req,
      res,
      result,
      {
        cookieOptions: LtiService.cookieOptions,
        emailVerification: true,
      },
      undefined,
      this.ltiService,
    )) as Response;
  }

  @Post('/password/reset')
  async requestPasswordReset(
    @Body() body: PasswordRequestResetBody,
    @Res() res: Response,
  ): Promise<Response<void>> {
    res = await this.authService.validateResetPasswordParams(res, body);
    if (res.headersSent) {
      return;
    }
    const { email, organizationId } = body;
    return await this.authService.issuePasswordReset(
      res,
      email,
      organizationId,
      '/lti',
    );
  }

  @Post('register')
  async register(
    @Body() body: AccountRegistrationParams,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void | Response<void>> {
    res = await this.authService.validateRegistrationParams(res, body);
    if (res.headersSent) {
      return;
    }

    return await this.authService.registerAccount(
      req,
      res,
      body,
      undefined,
      this.ltiService,
      {
        cookieName: 'lti_auth_token',
        restrictPaths,
        redirect: '/lti',
        cookieOptions: LtiService.cookieOptions,
        expiresIn: 60 * 10,
      },
    );
  }

  @Get('callback/:method')
  async callback(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Query('code') auth_code: string,
    @Req() req: Request,
  ): Promise<Response<void>> {
    return await this.authService.ssoAuthCallback(
      req,
      res,
      auth_method,
      auth_code,
      undefined,
      this.ltiService,
      {
        cookieName: 'lti_auth_token',
        prefix: '/lti',
        restrictPaths,
        redirect: '/lti',
        cookieOptions: LtiService.cookieOptions,
        expiresIn: 60 * 10,
      },
    );
  }

  private getAuthRedirectUri(method: string): string {
    return `${this.configService.get('DOMAIN')}/api/v1/lti/auth/callback/${method}`;
  }
}
