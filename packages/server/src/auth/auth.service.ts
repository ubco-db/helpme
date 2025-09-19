import {
  AccountRegistrationParams,
  AccountType,
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
        `(EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM auth_state_model."createdAt")) > auth_state_model."expiresIn"`,
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
      authState.expiresIn
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
      emailToken.expiresIn
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

  async issuePasswordReset(
    res: Response,
    email: string,
    organizationId: number,
    prefix?: string,
  ) {
    const user = await UserModel.findOne({
      where: {
        email,
        organizationUser: { organizationId },
        accountType: AccountType.LEGACY,
      },
      relations: ['organizationUser'],
    });

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
  ): Promise<Response> {
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

    const user = await UserModel.findOne({
      where: {
        email,
        organizationUser: { organizationId },
        accountType: AccountType.LEGACY,
      },
      relations: {
        organizationUser: true,
      },
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

    return res;
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

    // TODO: Remove comment
    // if (user && user.password) {
    //   throw new BadRequestException(
    //     'A non-SSO account already exists with this email. Please login with your email and password instead.',
    //   );
    // }

    // TODO: Remove comment
    // if (user && user.accountType !== AccountType.SHIBBOLETH) {
    //   throw new BadRequestException(
    //     'A non-SSO account already exists with this email. Please login with your email and password instead.',
    //   );
    // }

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

    // TODO: Remove comment
    // if (user && user.password) {
    //   throw new BadRequestException(
    //     'A non-SSO account already exists with this email. Please login with your email and password instead.',
    //   );
    // }

    // TODO: Remove comment
    // if (user && user.accountType !== AccountType.GOOGLE) {
    //   throw new BadRequestException(
    //     'A non-google account already exists with this email on HelpMe. Please try logging in with your email and password instead (or another SSO provider)',
    //   );
    // }

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
    return user != undefined && user.organizationUser?.organizationId == oid;
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
