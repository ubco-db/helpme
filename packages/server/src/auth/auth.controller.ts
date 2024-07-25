import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import {
  AccountRegistrationParams,
  AccountType,
  ERROR_MESSAGES,
  PasswordRequestResetBody,
  PasswordRequestResetWithTokenBody,
  RegistrationTokenDetails,
} from '@koh/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizationModel } from 'organization/organization.entity';
import { UserModel } from 'profile/user.entity';
import * as request from 'superagent';
import { MailService } from 'mail/mail.service';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import * as bcrypt from 'bcrypt';
import { getCookie } from '../common/helpers';

interface RequestUser {
  userId: string;
}

@Controller('auth')
export class AuthController {
  private GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private authService: AuthService,
  ) {}

  @Get('shibboleth/:oid')
  async shibbolethAuth(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid') organizationId: number,
  ): Promise<any> {
    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      return res.redirect(`/auth/failed/40000`);
    }
    if (!organization.ssoEnabled) {
      return res.redirect(`/auth/failed/40002`);
    }

    const uid = req.headers['x-trust-auth-uid'] ?? null;
    const mail = req.headers['x-trust-auth-mail'] ?? null;
    const role = req.headers['x-trust-auth-role'] ?? null;
    const givenName = req.headers['x-trust-auth-givenname'] ?? null;
    const lastName = req.headers['x-trust-auth-lastname'] ?? null;

    if (!uid || !mail || !role || !givenName || !lastName) {
      return res.redirect(`/auth/failed/40001`);
    }

    try {
      const userId = await this.authService.loginWithShibboleth(
        String(mail),
        String(role),
        String(givenName),
        String(lastName),
        organizationId,
      );

      this.enter(req, res, userId);
    } catch (err) {
      return res.redirect(`/auth/failed/40001`);
    }
  }

  @Get('link/:method/:oid')
  auth(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Param('oid') organizationId: number,
  ): Response<{ redirectUri: string }> {
    res.cookie('organization.id', organizationId, {
      httpOnly: true,
      secure: this.isSecure(),
    });

    switch (auth_method) {
      case 'google':
        return res.status(200).send({
          redirectUri:
            `${this.GOOGLE_AUTH_URL}?client_id=${process.env.GOOGLE_CLIENT_ID}.apps.googleusercontent.com` +
            `&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=openid%20profile%20email`,
        });
      default:
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: 'Invalid auth method' });
    }
  }

  @Post('registration/verify')
  @UseGuards(JwtAuthGuard)
  async validateRegistrationToken(
    @Res() res: Response,
    @Req() req: Request,
    @Body() registrationTokenDetails: RegistrationTokenDetails,
  ): Promise<Response<void>> {
    const { token } = registrationTokenDetails;

    const emailToken = await UserTokenModel.findOne({
      where: {
        token,
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        user: { id: Number((req.user as RequestUser).userId) },
      },
      relations: ['user'],
    });

    if (!emailToken) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Verification code was not found or it is not valid',
      });
    }

    if (emailToken.expires_at < parseInt(new Date().getTime().toString())) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Verification code has expired',
      });
    }

    emailToken.token_action = TokenAction.ACTION_COMPLETE;
    emailToken.user.emailVerified = true;
    await emailToken.user.save();
    await emailToken.save();
    const cookie = getCookie(req, '__SECURE_REDIRECT');

    if (cookie) {
      const decodedCookie = decodeURIComponent(cookie);
      return res.status(HttpStatus.TEMPORARY_REDIRECT).send({
        redirectUri: `/course/${decodedCookie.split(',')[0]}/invite?code=${decodedCookie.split(',')[1]}`,
      });
    } else {
      return res.status(HttpStatus.ACCEPTED).send({
        message: 'Email verified',
      });
    }
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

    if (passwordToken.expires_at < parseInt(new Date().getTime().toString())) {
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

    if (passwordToken.expires_at < parseInt(new Date().getTime().toString())) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Password reset token has expired',
      });
    }

    passwordToken.token_action = TokenAction.ACTION_COMPLETE;
    passwordToken.expires_at = parseInt(new Date().getTime().toString());
    await passwordToken.save();

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    passwordToken.user.password = hashedPassword;
    await passwordToken.user.save();

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Password reset successful',
    });
  }

  @Post('/password/reset')
  async resetPassword(
    @Body() body: PasswordRequestResetBody,
    @Res() res: Response,
  ): Promise<Response<void>> {
    const { email, recaptchaToken, organizationId } = body;

    if (!recaptchaToken) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Invalid recaptcha token' });
    }

    const response = await request.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.PRIVATE_RECAPTCHA_SITE_KEY}&response=${recaptchaToken}`,
    );

    if (!response.body.success) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Recaptcha token invalid',
      });
    }

    const user = await UserModel.findOne({
      where: {
        email,
        organizationUser: { organizationId },
        accountType: AccountType.LEGACY,
      },
      relations: ['organizationUser'],
    });

    if (!user) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'User not found' });
    }

    if (!user.emailVerified) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Email not verified' });
    }

    const resetLink = await this.authService.createPasswordResetToken(user);

    this.mailService.sendPasswordResetEmail(
      user.email,
      `${process.env.DOMAIN}/account/password/${resetLink}`,
    );

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Password reset email sent',
    });
  }

  @Post('register')
  async register(
    @Body() body: AccountRegistrationParams,
    @Res() res: Response,
  ): Promise<Response<void>> {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      sid,
      organizationId,
      recaptchaToken,
    } = body;

    if (!recaptchaToken) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Invalid recaptcha token' });
    }

    const response = await request.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.PRIVATE_RECAPTCHA_SITE_KEY}&response=${recaptchaToken}`,
    );

    if (!response.body.success) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Recaptcha token invalid',
      });
    }

    if (firstName.trim().length < 1 || lastName.trim().length < 1) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'First and last name must be at least 1 character' });
    }

    if (firstName.trim().length > 32 || lastName.trim().length > 32) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'First and last name must be at most 32 characters' });
    }

    if (email.trim().length < 4 || email.trim().length > 64) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Email must be between 4 and 64 characters' });
    }

    if (password.trim().length < 6 || password.trim().length > 32) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Password must be between 6 and 32 characters' });
    }

    if (password !== confirmPassword) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Passwords do not match' });
    }

    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Organization not found' });
    }

    const user = await UserModel.findOne({ where: { email } });

    if (user) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'Email already exists' });
    }

    if (sid) {
      const result = await this.authService.studentIdExists(
        sid,
        organizationId,
      );
      if (result) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: 'Student ID already exists' });
      }
    }

    try {
      const userId = await this.authService.register(
        firstName,
        lastName,
        email,
        password,
        sid ? sid : -1,
        organizationId,
      );

      const authToken = await this.createAuthToken(userId);

      if (authToken === null || authToken === undefined) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: ERROR_MESSAGES.loginController.invalidTempJWTToken,
        });
      }

      return res
        .cookie('auth_token', authToken, {
          httpOnly: true,
          secure: this.isSecure(),
        })
        .send({ message: 'Account created' });
    } catch (err) {
      return res.status(HttpStatus.BAD_REQUEST).send({ message: err.message });
    }
  }

  @Get('callback/:method')
  async callback(
    @Res() res: Response,
    @Param('method') auth_method: string,
    @Query('code') auth_code: string,
    @Req() req: Request,
  ): Promise<Response<void>> {
    const organizationId = getCookie(req, 'organization.id');

    if (!organizationId) {
      res.redirect(`/auth/failed/40000`);
    } else {
      try {
        let payload: number;

        switch (auth_method) {
          case 'google':
            payload = await this.authService.loginWithGoogle(
              auth_code,
              Number(organizationId),
            );
            break;
          default:
            return res
              .status(HttpStatus.BAD_REQUEST)
              .send({ message: 'Invalid auth method' });
        }

        res.clearCookie('organization.id', {
          httpOnly: true,
          secure: this.isSecure(),
        });

        this.enter(req, res, payload);
      } catch (err) {
        res.redirect(`/auth/failed/40001`);
      }
    }
  }

  private async enter(req: Request, res: Response, userId: number) {
    const authToken = await this.createAuthToken(userId);

    if (authToken === null || authToken === undefined) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: ERROR_MESSAGES.loginController.invalidTempJWTToken });
    }

    const cookie = getCookie(req, '__SECURE_REDIRECT');
    let redirectUrl: string;

    if (cookie) {
      const decodedCookie = decodeURIComponent(cookie);
      redirectUrl = `/course/${decodedCookie.split(',')[0]}/invite?code=${decodedCookie.split(',')[1]}`;
    } else {
      redirectUrl = '/courses';
    }

    res
      .cookie('auth_token', authToken, {
        httpOnly: true,
        secure: this.isSecure(),
      })
      .redirect(HttpStatus.FOUND, redirectUrl);
  }

  private async createAuthToken(userId: number): Promise<string> {
    // Expires in 30 days
    return await this.jwtService.signAsync({
      userId,
      expiresIn: 60 * 60 * 24 * 30,
    });
  }

  private isSecure(): boolean {
    return this.configService.get<string>('DOMAIN').startsWith('https://');
  }
}
