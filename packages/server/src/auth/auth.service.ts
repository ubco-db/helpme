import {
  AccountRegistrationParams,
  AccountType,
  ERROR_MESSAGES,
  OrganizationRole,
  OrgRoleChangeReason,
  RegistrationTokenDetails,
} from '@koh/common';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserModel } from 'profile/user.entity';
import * as bcrypt from 'bcrypt';
import {
  TokenAction,
  TokenType,
  UserTokenModel,
} from 'profile/user-token.entity';
import { MailService } from 'mail/mail.service';
import { MailServiceModel } from 'mail/mail-services.entity';
import { ChatTokenModel } from 'chatbot/chat-token.entity';
import { v4 } from 'uuid';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { OrganizationService } from '../organization/organization.service';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CourseService } from '../course/course.service';
import { LtiService } from '../lti/lti.service';
import { OrganizationModel } from '../organization/organization.entity';
import * as request from 'superagent';
import { LoginEntryOptions, LoginService } from '../login/login.service';
import { AuthStateModel } from './auth-state.entity';
import * as crypto from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ILike } from 'typeorm';
import * as Sentry from '@sentry/nestjs';

export const AUTH_URL = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
};

export const OPEN_ID_AUTH = ['google'];
export const OPEN_ID_SCOPES = ['openid', 'profile', 'email'];

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private loginService: LoginService,
    private mailerService: MailService,
    private organizationService: OrganizationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'CLEAR_AUTH_STATES' })
  async clearAuthStates() {
    await AuthStateModel.createQueryBuilder()
      .delete()
      .where(
        `(EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM auth_state_model."createdAt")) > auth_state_model."expiresInSeconds"`,
      )
      .execute();
  }

  async registerAccount(
    req: Request,
    res: Response,
    body: AccountRegistrationParams,
    courseService?: CourseService,
    ltiService?: LtiService,
    options: LoginEntryOptions = {},
  ) {
    try {
      const userId = await this.register({
        ...body,
        sid: body.sid ? body.sid : -1,
      });
      // create student subscriptions
      await this.createStudentSubscriptions(userId);

      return await this.loginService.enter(
        req,
        res,
        userId,
        courseService,
        ltiService,
        {
          ...options,
          returnImmediate: true,
          returnImmediateMessage: 'Account created',
        },
      );
    } catch (err) {
      return res.status(HttpStatus.BAD_REQUEST).send({ message: err.message });
    }
  }

  async ssoAuthInit(
    res: Response,
    auth_method: string,
    organizationId: number,
    authMode: 'default' | 'lti' = 'default',
  ): Promise<Response<{ redirectUri: string } | { message: string }>> {
    if (!(await OrganizationModel.findOne({ where: { id: organizationId } }))) {
      return res.status(404).send({ message: 'Organization not found' });
    }

    const authState = await AuthStateModel.create({
      state: crypto.randomBytes(32).toString('hex'),
      organizationId,
    }).save();

    const baseUrl = AUTH_URL[auth_method];
    const query = new URLSearchParams();

    query.set('state', authState.state);

    if (OPEN_ID_AUTH.includes(auth_method)) {
      query.set('scope', OPEN_ID_SCOPES.join(' '));
    }

    const redirect_uri = this.getAuthMethodRedirectUri(auth_method, authMode);
    query.set('redirect_uri', redirect_uri);

    switch (auth_method) {
      case 'google':
        query.set(
          'client_id',
          this.configService.get<string>('GOOGLE_CLIENT_ID') +
            '.apps.googleusercontent.com',
        );
        query.set('response_type', 'code');

        return res
          .status(200)
          .send({ redirectUri: `${baseUrl}?${query.toString()}` });
      default:
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: 'Invalid auth method' });
    }
  }

  async shibbolethAuthCallback(
    req: Request,
    res: Response,
    organizationId: number,
    courseService?: CourseService,
    ltiService?: LtiService,
    options: LoginEntryOptions & { prefix?: string } = {},
  ) {
    const cookieOptions = options?.cookieOptions ?? {
      secure: this.configService.get<string>('DOMAIN').startsWith('https'),
      httpOnly: true,
    };

    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40000`);
    }
    if (!organization.ssoEnabled) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40002`);
    }

    // const uid = req.headers['x-trust-auth-uid'] ?? null;
    const mail = req.headers['x-trust-auth-mail'] ?? null;
    // const role = req.headers['x-trust-auth-role'] ?? null;
    const givenName = req.headers['x-trust-auth-givenname'] ?? null;
    const lastName = req.headers['x-trust-auth-lastname'] ?? null;

    if (!mail || !givenName || !lastName) {
      return res.redirect(
        `${options?.prefix ?? ''}/login?error=errorCode${HttpStatus.BAD_REQUEST}${encodeURIComponent('The login service you logged in with did not provide the required email, first name, and last name headers')}`,
      );
    }

    try {
      const userId = await this.loginWithShibboleth(
        String(mail),
        String(givenName),
        String(lastName),
        organizationId,
      );

      await this.loginService.enter(
        req,
        res,
        userId,
        courseService,
        ltiService,
        {
          cookieOptions,
          ...options,
        },
      );
    } catch (err) {
      if (err instanceof HttpException) {
        return res.redirect(
          `${options?.prefix ?? ''}/login?error=errorCode${err.getStatus()}${encodeURIComponent(err.message)}`,
        );
      }
      return res.redirect(
        `${options?.prefix ?? ''}/login?error=errorCode${HttpStatus.INTERNAL_SERVER_ERROR}${encodeURIComponent(err.message)}`,
      );
    }
  }

  async ssoAuthCallback(
    req: Request,
    res: Response,
    auth_method: string,
    auth_code: string,
    auth_state: string,
    courseService?: CourseService,
    ltiService?: LtiService,
    options: LoginEntryOptions & { prefix?: string } = {},
    authMode: 'default' | 'lti' = 'default',
  ): Promise<Response<void> | void> {
    const cookieOptions = options?.cookieOptions ?? {
      secure: this.configService.get<string>('DOMAIN').startsWith('https'),
      httpOnly: true,
    };

    if (!auth_state) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40003`);
    }

    const authState = await AuthStateModel.findOne({
      where: {
        state: auth_state,
      },
      relations: {
        organization: true,
      },
    });

    if (!authState) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40000`);
    }

    if (!authState.organization.googleAuthEnabled) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40002`);
    }

    if (
      (Date.now() - authState.createdAt.getTime()) / 1000 >
      authState.expiresInSeconds
    ) {
      return res.redirect(`${options?.prefix ?? ''}/failed/40004`);
    }

    await authState.remove();

    try {
      let userId: number;

      switch (auth_method) {
        case 'google':
          userId = await this.loginWithGoogle(
            auth_code,
            Number(authState.organizationId),
            authMode,
          );
          break;
        default:
          return res
            .status(HttpStatus.BAD_REQUEST)
            .send({ message: 'Invalid auth method' });
      }

      return await this.loginService.enter(
        req,
        res,
        userId,
        courseService,
        ltiService,
        {
          cookieOptions,
          ...options,
        },
      );
    } catch (err) {
      if (err instanceof HttpException) {
        return res.redirect(
          `${options.prefix ?? ''}/login?error=errorCode${err.getStatus()}${encodeURIComponent(err.message)}`,
        );
      } else {
        return res.redirect(
          `${options.prefix ?? ''}/login?error=errorCode${HttpStatus.INTERNAL_SERVER_ERROR}${encodeURIComponent(err.message)}`,
        );
      }
    }
  }

  async verifyRegistrationToken(
    res: Response,
    userId: number,
    registrationTokenDetails: RegistrationTokenDetails,
  ): Promise<Response | number> {
    const { token } = registrationTokenDetails;

    const emailToken = await UserTokenModel.findOne({
      where: {
        token,
        token_type: TokenType.EMAIL_VERIFICATION,
        token_action: TokenAction.ACTION_PENDING,
        user: {
          id: userId,
        },
      },
      relations: ['user'],
    });

    if (!emailToken) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Verification code was not found or it is not valid',
      });
    }

    if (
      (Date.now() - emailToken.createdAt.getTime()) / 1000 >
      emailToken.expiresInSeconds
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: 'Verification code has expired',
      });
    }

    emailToken.token_action = TokenAction.ACTION_COMPLETE;
    emailToken.user.emailVerified = true;
    await emailToken.user.save();
    await emailToken.save();

    return userId;
  }

  async validateRegistrationParams(
    res: Response,
    body: AccountRegistrationParams,
  ): Promise<Response> {
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
      `https://www.google.com/recaptcha/api/siteverify?secret=${this.configService.get<string>('PRIVATE_RECAPTCHA_SITE_KEY')}&response=${recaptchaToken}`,
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
      const result = await this.studentIdExists(sid, organizationId);
      if (result) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: 'Student ID already exists' });
      }
    }

    return res;
  }

  async issuePasswordReset(res: Response, user: UserModel, prefix?: string) {
    const resetToken = await this.createPasswordResetToken(user);

    this.mailerService
      .sendPasswordResetEmail(
        user.email,
        `${this.configService.get<string>('DOMAIN')}${prefix ?? ''}/password/${resetToken}`,
      )
      .then();

    return res.status(HttpStatus.ACCEPTED).send({
      message: 'Password reset email sent',
    });
  }

  async validateResetPasswordParams(
    res: Response,
    {
      email,
      recaptchaToken,
      organizationId,
    }: { email: string; recaptchaToken: string; organizationId: number },
  ): Promise<{ res: Response; user?: UserModel }> {
    if (!recaptchaToken) {
      return {
        res: res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: 'Invalid recaptcha token' }),
      };
    }

    const response = await request.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${this.configService.get<string>('PRIVATE_RECAPTCHA_SITE_KEY')}&response=${recaptchaToken}`,
    );

    if (!response.body.success) {
      return {
        res: res.status(HttpStatus.BAD_REQUEST).send({
          message: 'Recaptcha token invalid',
        }),
      };
    }

    const users = await UserModel.find({
      where: {
        email: ILike(email), // Case insensitive search (since users can mistype emails)
        organizationUser: { organizationId },
      },
      relations: {
        organizationUser: {
          organization: true,
        },
      },
    });
    let user: UserModel;
    if (!users || users.length === 0) {
      return {
        res: res
          .status(HttpStatus.NOT_FOUND)
          .send({
            message: ERROR_MESSAGES.authController.userNotFoundWithEmail,
          }),
      };
    } else if (users.length === 1) {
      // this is like 99.9% of users
      user = users[0];
    } else {
      Sentry.captureMessage(
        'Multiple users found with same email (can be case-sensitivity issue or multiple accounts with same type).',
        {
          level: 'error',
          extra: {
            users: users.map((user) => ({
              id: user.id,
              // email: user.email, // decided against logging email in sentry since then sentry would be collecting emails and UBC PIA probably won't like that
            })),
          },
        },
      );

      const usersWithLegacyAccountType = users.filter(
        (user) => user.accountType === AccountType.LEGACY,
      );

      // Find the legacy account and use it if it exists (Note that it shouldn't actually be possible to have multiple accounts with same email and different types)
      if (usersWithLegacyAccountType.length === 1) {
        user = usersWithLegacyAccountType[0];
        // If there isn't one, use the first user.
      } else if (usersWithLegacyAccountType.length === 0) {
        user = users[0];
        // If there's multiple legacy accounts, it's a case-sensitivity issue.
      } else if (usersWithLegacyAccountType.length > 1) {
        // this SHOULDN'T happen since emails should be unique. But, /register lacked case-insensitivity so some users have multiple accounts with same email (with different case).
        return {
          res: res.status(HttpStatus.BAD_REQUEST).send({
            message:
              'Multiple users found with this email (can be case-sensitivity issue). Please contact adam.fipke@ubc.ca',
          }),
        };
      }
    }

    // now handle logic for the user
    if (user.accountType === AccountType.GOOGLE) {
      return {
        res: res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: ERROR_MESSAGES.authController.ssoAccountGoogle }),
      };
    } else if (user.accountType === AccountType.SHIBBOLETH) {
      return {
        res: res.status(HttpStatus.BAD_REQUEST).send({
          message: ERROR_MESSAGES.authController.ssoAccountShibboleth(
            user.organizationUser.organization.name,
          ),
        }),
      };
    } else if (user.accountType !== AccountType.LEGACY) {
      return {
        res: res
          .status(HttpStatus.BAD_REQUEST)
          .send({
            message: ERROR_MESSAGES.authController.incorrectAccountType,
          }),
      };
    }

    // DON'T reject unverified emails (since someone could create an account for someone else's email and then leave it unverified, with the real user not able to log in)

    return { res: res, user: user };
  }

  async createStudentSubscriptions(userId: number): Promise<void> {
    try {
      const allMailServices = await MailServiceModel.find();
      if (!allMailServices) {
        console.error(
          "For some reason there are no mail services in the database. Please check the database and populate them if you haven't.",
        );
        return;
      }
      const subscriptions = allMailServices.map((service) => {
        const subscription = new UserSubscriptionModel();
        subscription.userId = userId;
        subscription.serviceId = service.id;
        subscription.isSubscribed = true;
        return subscription;
      });

      await UserSubscriptionModel.save(subscriptions);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      throw new HttpException(
        'There was a error saving user mail subscriptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loginWithShibboleth(
    mail: string,
    givenName: string,
    lastName: string,
    organizationId: number,
  ): Promise<number> {
    const user = await UserModel.findOne({
      where: {
        email: mail,
      },
    });

    // Remove non-SSO account password if the account was previously unverified (could have been a loose registration
    // using their email)
    if (user && user.password && !user.emailVerified) {
      await UserModel.update(
        { id: user.id },
        {
          password: null, // null: delete existing password as no way of knowing if user is the one who added it
          emailVerified: true, // they have now logged in with SSO, so we know their email is valid
          accountType: AccountType.SHIBBOLETH,
        },
      );
    }

    if (user) {
      return user.id;
    } else {
      const newUser = await UserModel.create({
        email: mail,
        firstName: givenName,
        lastName: lastName,
        accountType: AccountType.SHIBBOLETH,
        emailVerified: true,
      }).save();

      const userId = newUser.id;

      const orgUser = await OrganizationUserModel.create({
        organizationId,
        userId: userId,
        role: OrganizationRole.MEMBER,
      }).save();

      await ChatTokenModel.create({
        user: newUser,
        token: v4(),
      }).save();

      await this.organizationService.addRoleHistory(
        organizationId,
        null,
        OrganizationRole.MEMBER,
        null,
        orgUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );

      await this.createStudentSubscriptions(userId);
      return userId;
    }
  }

  async loginWithGoogle(
    auth_code: string,
    organizationId: number,
    authMode: 'default' | 'lti' = 'default',
  ): Promise<number> {
    const redirect_uri = this.getAuthMethodRedirectUri('google', authMode);

    const client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      redirect_uri,
    );

    const { tokens } = await client.getToken(auth_code);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: `${this.configService.get<string>('GOOGLE_CLIENT_ID')}.apps.googleusercontent.com`,
    });

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      throw new BadRequestException('Email not verified');
    }

    const user = await UserModel.findOne({
      where: {
        email: payload.email,
        organizationUser: {
          organizationId: organizationId,
        },
      },
      relations: ['organizationUser'],
    });

    // Remove non-SSO account password if the account was previously unverified (could have been a loose registration
    // using their email)
    if (user && user.password && !user.emailVerified) {
      await UserModel.update(
        { id: user.id },
        {
          password: null, // null: delete existing password as no way of knowing if user is the one who added it
          emailVerified: true, // they have now logged in with SSO, so we know their email is valid
          accountType: AccountType.GOOGLE,
        },
      );
    }

    if (user) {
      return user.id;
    } else {
      const newUser = await UserModel.create({
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        photoURL: payload.picture,
        accountType: AccountType.GOOGLE,
        emailVerified: true,
      }).save();

      const userId = newUser.id;

      const orgUser = await OrganizationUserModel.create({
        organizationId,
        userId: userId,
      }).save();

      await this.organizationService.addRoleHistory(
        organizationId,
        null,
        OrganizationRole.MEMBER,
        null,
        orgUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );

      await ChatTokenModel.create({
        user: newUser,
        token: v4(),
      }).save();

      await this.createStudentSubscriptions(userId);
      return userId;
    }
  }

  async register({
    firstName,
    lastName,
    email,
    password,
    sid,
    organizationId,
  }: Omit<
    AccountRegistrationParams,
    'confirmPassword' | 'recaptchaToken'
  >): Promise<number> {
    try {
      const user = await UserModel.findOne({
        where: {
          email: email,
        },
      });

      if (user) {
        throw new BadRequestException('Email already exists');
      }

      let newUser: UserModel;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      if (sid == -1) {
        newUser = await UserModel.create({
          courses: [],
          email,
          firstName,
          lastName,
          password: hashedPassword,
          hideInsights: [],
        }).save();
      } else {
        newUser = await UserModel.create({
          courses: [],
          email,
          firstName,
          lastName,
          password: hashedPassword,
          sid,
          hideInsights: [],
        }).save();
      }

      const token: string = this.generateToken(8);
      await UserTokenModel.create({
        user: newUser,
        token: token,
      }).save();

      await this.mailerService.sendUserVerificationCode(token, email);

      const userId = newUser.id;

      const orgUser = await OrganizationUserModel.create({
        organizationId,
        userId,
        role: OrganizationRole.MEMBER,
      }).save();

      await this.organizationService.addRoleHistory(
        organizationId,
        null,
        OrganizationRole.MEMBER,
        null,
        orgUser.id,
        OrgRoleChangeReason.joinedOrganizationMember,
      );

      await ChatTokenModel.create({
        user: newUser,
        token: v4(),
      }).save();

      return userId;
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async studentIdExists(sid: number, oid: number): Promise<boolean> {
    const user = await UserModel.findOne({
      where: { sid },
      relations: {
        organizationUser: true,
      },
    });
    return !!user && user.organizationUser?.organizationId === oid;
  }

  async createPasswordResetToken(user: UserModel): Promise<string> {
    const token = this.generateToken(12).toLowerCase();
    await UserTokenModel.create({
      user,
      token,
      token_type: TokenType.PASSWORD_RESET,
    }).save();

    return token;
  }

  private getAuthMethodRedirectUri(
    auth_method: string,
    authMode: 'default' | 'lti' = 'default',
  ) {
    return `${this.configService.get('DOMAIN')}/api/v1${authMode == 'lti' ? '/lti' : ''}/auth/callback/${auth_method}`;
  }

  private generateToken(length: number): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      token += characters.charAt(randomIndex);
    }
    return token;
  }
}
