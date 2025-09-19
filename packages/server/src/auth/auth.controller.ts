import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  AccountRegistrationParams,
  PasswordRequestResetBody,
  PasswordRequestResetWithTokenBody,
  RegistrationTokenDetails,
} from '@koh/common';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import * as bcrypt from 'bcrypt';
import { CourseService } from 'course/course.service';
import { LoginService } from '../login/login.service';
import { UserId } from '../decorators/user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private courseService: CourseService,
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
      this.courseService,
      undefined,
      {
        cookieOptions: {
          httpOnly: true,
          secure: this.isSecure(),
        },
      },
    );
  }

  @Get('link/:method/:oid')
  async auth(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<Response<{ redirectUri: string } | { message: string }>> {
    return this.authService.ssoAuthInit(res, auth_method, organizationId);
  }

  @Post('registration/verify')
  @UseGuards(JwtAuthGuard)
  async validateRegistrationToken(
    @Res() res: Response,
    @Req() req: Request,
    @UserId() userId: number,
    @Body() registrationTokenDetails: RegistrationTokenDetails,
  ): Promise<Response<void>> {
    const result = await this.authService.verifyRegistrationToken(
      res,
      userId,
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
        cookieOptions: {
          httpOnly: true,
          secure: this.isSecure(),
        },
        emailVerification: true,
      },
      this.courseService,
    )) as Response;
  }

  @Get('/password/reset/validate/:token')
  async validatePasswordResetToken(
    @Res() res: Response,
    @Param('token') token: string,
  ): Promise<Response<void>> {
    const passwordToken = await UserTokenModel.findOne({
      where: {
        token,
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
      },
    });

    if (!passwordToken) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Password reset token was not found or it is not valid',
      });
    }

    if (
      (Date.now() - passwordToken.createdAt.getTime()) / 1000 >
      passwordToken.expiresIn
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Password reset token has expired',
      });
    }

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Password reset token is valid',
    });
  }

  @Post('/password/reset/:token')
  async resetPasswordToken(
    @Body() body: PasswordRequestResetWithTokenBody,
    @Res() res: Response,
    @Param('token') token: string,
  ): Promise<Response<void>> {
    const { password, confirmPassword } = body;

    if (password !== confirmPassword) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Passwords do not match',
      });
    }

    const passwordToken = await UserTokenModel.findOne({
      where: {
        token,
        token_type: TokenType.PASSWORD_RESET,
        token_action: TokenAction.ACTION_PENDING,
      },
      relations: ['user'],
    });

    if (!passwordToken) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Password reset token was not found or it is not valid',
      });
    }

    if (
      (Date.now() - passwordToken.createdAt.getTime()) / 1000 >
      passwordToken.expiresIn
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Password reset token has expired',
      });
    }

    passwordToken.token_action = TokenAction.ACTION_COMPLETE;
    passwordToken.expiresIn = 0;
    await passwordToken.save();

    const salt = await bcrypt.genSalt(10);
    passwordToken.user.password = await bcrypt.hash(password, salt);
    await passwordToken.user.save();

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Password reset successful',
    });
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
      this.courseService,
      undefined,
      {
        cookieOptions: {
          httpOnly: true,
          secure: this.isSecure(),
        },
      },
    );
  }

  @Get('callback/:method')
  async callback(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Query('code') auth_code: string,
    @Query('state') auth_state: string,
    @Req() req: Request,
  ): Promise<Response<void> | void> {
    return await this.authService.ssoAuthCallback(
      req,
      res,
      auth_method,
      auth_code,
      auth_state,
      this.courseService,
      undefined,
      {
        cookieOptions: {
          httpOnly: true,
          secure: this.isSecure(),
        },
      },
    );
  }

  private isSecure(): boolean {
    return this.configService.get<string>('DOMAIN').startsWith('https://');
  }
}
