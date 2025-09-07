import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CourseService } from '../course/course.service';
import { LtiService } from '../lti/lti.service';
import { ERROR_MESSAGES } from '@koh/common';
import { CookieOptions, Request, Response } from 'express';
import { getCookie } from '../common/helpers';

export type LoginEntryOptions = {
  cookieName?: string;
  cookieOptions?: CookieOptions;
  restrictPaths?: (RegExp | string)[] | RegExp | string;
  expiresIn?: number;
  redirect?: string;
  returnImmediate?: boolean;
  returnImmediateMessage?: string;
};

@Injectable()
export class LoginService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * @description Performs the entry mechanism to authorize users.
   * @param {Request} req Originating request
   * @param {Response} res Response object
   * @param {number} userId The UserId to be logged in
   * @param {CourseService} courseService The CourseService instance, if any, to use
   * @param {ltiService} ltiService The CourseService instance, if any, to use
   * @param {LoginEntryOptions} options Set of options to modify the generated token
   * @param {CookieOptions} options.cookieOptions Options to modify how the cookie is signed
   * @param {RegExp | string | (RegExp | string)[]} options.restrictPaths API/frontend paths this token should be allowed to use
   * @param {Number} options.expiresIn When the authorization token should expire
   * @param {String} options.redirect Override all other redirections to follow this path. Query parameters are extracted and applied after.
   * @Param {boolean} options.returnImmediate Override all redirections and cookies to return immediately with 200 OK.
   * @Param {String} options.returnImmediateMessage (Optional) Message to be sent with return immediate. Defaults to 'OK'.
   * @returns {void | Response} Returns 'void' if authorization is successful. Returns 500-level error response otherwise.
   */
  async enter(
    req: Request,
    res: Response,
    userId: number,
    courseService?: CourseService,
    ltiService?: LtiService,
    options: LoginEntryOptions = {},
  ): Promise<void | Response> {
    const {
      cookieName,
      restrictPaths,
      expiresIn,
      redirect,
      returnImmediate,
      returnImmediateMessage,
    } = options ?? {};
    let cookieOptions = options?.cookieOptions ?? { httpOnly: true };

    const secure = cookieOptions
      ? cookieOptions.secure
      : this.configService.get<string>('DOMAIN').startsWith('https://');

    cookieOptions = {
      ...cookieOptions,
      secure,
    };

    let authToken: string;
    try {
      authToken = await this.generateAuthToken(
        userId,
        expiresIn,
        restrictPaths,
      );
    } catch (err) {
      if (err instanceof HttpException) {
        return res.status(err.getStatus()).send(err.getResponse());
      } else {
        return res.status(500).send({ message: (err as Error).message });
      }
    }

    if (returnImmediate) {
      return res
        .cookie(cookieName ?? 'auth_token', authToken, cookieOptions)
        .send({ message: returnImmediateMessage ?? 'OK' });
    }

    let result = await this.handleCookies(
      req,
      res,
      userId,
      {
        cookieOptions,
        redirect,
        emailVerification: false,
      },
      courseService,
      ltiService,
    );

    if ('headersSent' in result && (result as Response).headersSent) {
      return;
    }

    result = result as { res: Response; redirectUrl: string };
    res = result.res;
    const { redirectUrl } = result;
    if (res.headersSent) {
      return;
    }

    return res
      .cookie(cookieName ?? 'auth_token', authToken, cookieOptions)
      .redirect(HttpStatus.FOUND, redirectUrl);
  }

  async handleCookies(
    req: Request,
    res: Response,
    userId: number,
    options: {
      cookieOptions: CookieOptions;
      redirect?: string;
      emailVerification?: boolean;
    },
    courseService?: CourseService,
    ltiService?: LtiService,
  ): Promise<Response | { res: Response; redirectUrl: string }> {
    const { emailVerification, cookieOptions } = options;
    let { redirect } = options;

    let redirectUrl: string;
    const initialParams: Record<string, string> = redirect
      ?.split('?')[1]
      ?.split('&')
      .map((v) => v.split('='))
      .reduce((p, c) => ({ ...p, [c[0]]: c[1] }), {});

    const paramIndex = redirect?.indexOf('?') ?? -1;
    if (paramIndex >= 0) {
      redirect = redirect.substring(0, paramIndex);
    }
    const queryParams = new URLSearchParams(initialParams);

    const secureRedirectCookie = getCookie(req, '__SECURE_REDIRECT');
    const queueInviteCookie = getCookie(req, 'queueInviteInfo');
    const ltiInviteCookie = getCookie(req, '__COURSE_INVITE');

    if (queueInviteCookie && courseService) {
      await courseService
        .getQueueInviteRedirectURLandInviteToCourse(queueInviteCookie, userId)
        .then((url) => {
          redirectUrl = url;
          res.clearCookie('queueInviteInfo');
        });
    } else if (secureRedirectCookie) {
      const decodedCookie = decodeURIComponent(secureRedirectCookie);
      redirectUrl = `/invite?cid=${decodedCookie.split(',')[0]}&code=${encodeURIComponent(decodedCookie.split(',')[1])}`;
      res.clearCookie('__SECURE_REDIRECT', cookieOptions);
    } else if (ltiInviteCookie && ltiService) {
      const inviteToken = decodeURIComponent(ltiInviteCookie);
      let courseId: number | undefined;
      if (inviteToken) {
        try {
          courseId = await ltiService.checkCourseInvite(userId, inviteToken);
        } catch (err) {
          queryParams.set('error_message', (err as Error).message);
        }
      }
      redirectUrl = `/lti/${courseId}`;
      res.clearCookie('__COURSE_INVITE', cookieOptions);
    } else if (redirect) {
      redirectUrl = redirect;
    } else {
      redirectUrl = emailVerification ? undefined : '/courses';
    }

    redirectUrl =
      redirectUrl != undefined
        ? `${redirectUrl}${queryParams.size > 0 ? '?' + queryParams.toString() : ''}`
        : undefined;

    if (emailVerification && redirectUrl) {
      return res.status(HttpStatus.TEMPORARY_REDIRECT).send({
        redirectUri: redirectUrl,
      });
    } else if (emailVerification) {
      return res.status(HttpStatus.ACCEPTED).send({
        message: 'Email verified',
      });
    }

    return {
      res,
      redirectUrl,
    };
  }

  async generateAuthToken(
    userId: number,
    expiresIn: number = 60 * 60 * 24 * 30, // Expires in 30 days (Default)
    restrictPaths?: (RegExp | string) | (RegExp | string)[],
  ) {
    const authToken = await this.jwtService.signAsync({
      userId,
      expiresIn,
      restrictPaths,
    });

    if (authToken === null || authToken === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.loginController.invalidTempJWTToken,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return authToken;
  }
}
