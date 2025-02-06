import { ERROR_MESSAGES, UBCOloginParam } from '@koh/common';
import {
  Body,
  Controller,
  Get,
  Req,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as request from 'superagent';
import { getCookie } from 'common/helpers';
import { CourseService } from 'course/course.service';
import { minutes, Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth/auth.service';

// Only 7 attempts per minute
@Throttle({ default: { limit: 7, ttl: minutes(1) } })
@Controller()
export class LoginController {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private courseService: CourseService,
    private authService: AuthService,
  ) {}

  @Post('/ubc_login')
  async receiveDataFromLogin(
    @Res() res: Response,
    @Body() body: UBCOloginParam,
  ): Promise<any> {
    if (process.env.NODE_ENV !== 'development') {
      if (!body.recaptchaToken) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message: 'Recaptcha token missing',
        });
      }
      const response = await request.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.PRIVATE_RECAPTCHA_SITE_KEY}&response=${body.recaptchaToken}`,
      );

      if (!response.body.success) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message: 'Recaptcha token invalid',
        });
      }
    }

    const user = await this.authService
      .getUserByEmailQuery(body.email)
      .leftJoinAndSelect('organizationUser.organization', 'org')
      .getOne();

    if (!user) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'User Not found' });
    }

    if (
      user.organizationUser &&
      user.organizationUser.organization.legacyAuthEnabled === false
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: 'Organization does not allow login with username/password',
      });
    }

    const token = await this.jwtService.signAsync(
      { userId: user.id },
      { expiresIn: 60 },
    );

    if (token === null || token === undefined) {
      console.error('Temporary JWT is invalid');
      throw new HttpException(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (user.password === null || user.password === undefined) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message:
          'User was created with Institution/Google. Please login with Institution or Google instead',
      });
    }

    bcrypt.compare(body.password, user.password, (err, data) => {
      //if error than throw error
      if (err) throw err;

      //if both match than you can do anything
      if (data) {
        if (user.accountDeactivated) {
          return res.status(HttpStatus.FORBIDDEN).send({
            message: 'Account deactivated',
          });
        }
        delete body.recaptchaToken;
        return res.status(200).send({ token, ...body });
      } else {
        return res.status(401).json({ message: 'Wrong Password' });
      }
    });
  }

  // NOTE: Although the two routes below are on the backend,
  // they are meant to be visited by the browser so a cookie can be set

  // This is the real admin entry point, Kevin changed to also just take a user id, change to that sign in only
  @Get('/login/entry')
  async enterUBCOH(
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') token: string,
  ): Promise<void> {
    const isVerified = await this.jwtService.verifyAsync(token);

    if (!isVerified) {
      throw new UnauthorizedException();
    }

    const payload = this.jwtService.decode(token) as { userId: number };
    await this.enter(req, res, payload.userId);
  }

  // Set cookie and redirect to proper page
  private async enter(req: Request, res: Response, userId: number) {
    // Expires in 30 days
    const authToken = await this.jwtService.signAsync({
      userId,
      expiresIn: 60 * 60 * 24 * 30,
    });

    if (authToken === null || authToken === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let redirectUrl: string;
    const cookie = getCookie(req, '__SECURE_REDIRECT');
    const queueInviteCookie = getCookie(req, 'queueInviteInfo');

    if (queueInviteCookie) {
      await this.courseService
        .getQueueInviteRedirectURLandInviteToCourse(queueInviteCookie, userId)
        .then((url) => {
          redirectUrl = url;
          res.clearCookie('queueInviteInfo');
        });
    } else if (cookie) {
      const decodedCookie = decodeURIComponent(cookie);
      redirectUrl = `/invite?cid=${decodedCookie.split(',')[0]}&code=${encodeURIComponent(decodedCookie.split(',')[1])}`;
    } else {
      redirectUrl = '/courses';
    }

    const isSecure = this.configService
      .get<string>('DOMAIN')
      .startsWith('https://');
    res
      .cookie('auth_token', authToken, { httpOnly: true, secure: isSecure })
      .redirect(HttpStatus.FOUND, redirectUrl);
  }

  @Get('/logout')
  async logout(@Res() res: Response): Promise<void> {
    const isSecure = this.configService
      .get<string>('DOMAIN')
      .startsWith('https://');
    res
      .clearCookie('auth_token', { httpOnly: true, secure: isSecure })
      .redirect(302, '/login');
  }
}
