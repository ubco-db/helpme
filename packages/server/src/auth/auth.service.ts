import { AccountType, OrganizationRole } from '@koh/common';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserModel } from 'profile/user.entity';
import * as bcrypt from 'bcrypt';
import { TokenType, UserTokenModel } from 'profile/user-token.entity';
import { MailService } from 'mail/mail.service';
import { MailServiceModel } from 'mail/mail-services.entity';
import { ChatTokenModel } from 'chatbot/chat-token.entity';
import { v4 } from 'uuid';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
// import { QueryBuilder, SelectQueryBuilder } from 'typeorm';

@Injectable()
export class AuthService {
  client: OAuth2Client;

  constructor(private mailerService: MailService) {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  async createStudentSubscriptions(userId: number): Promise<void> {
    try {
      const memberMailServices = await MailServiceModel.find({
        where: { mailType: 'member' },
      });
      if (!memberMailServices) {
        return;
      }
      const subscriptions = memberMailServices.map((service) => {
        const subscription = new UserSubscriptionModel();
        subscription.userId = userId;
        subscription.serviceId = service.id;
        subscription.isSubscribed = true;
        return subscription;
      });

      await UserSubscriptionModel.save(subscriptions);
    } catch (err) {
      throw new HttpException(
        'There was a error saving user mail subscriptions',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loginWithShibboleth(
    mail: string,
    role: string,
    givenName: string,
    lastName: string,
    organizationId: number,
  ): Promise<number> {
    try {
      const user = await UserModel.findOne({ email: mail });

      /*
      I don't think we need to worry about the Shibboleth auth being case insensitive,
      as the account is created directly from the credentials supplied by the third-party,
      and later log-in attempts use those precise credentials from the third party

      Leaving the code regardless!
       */

      /*
      const user = await new SelectQueryBuilder<UserModel>(UserModel.createQueryBuilder('UserModel'))
        .select()
        .where('LOWER(`UserModel`.email) = :mail', { mail: mail.toLowerCase() })
        .getOne();
      */

      if (user && user.password) {
        throw new BadRequestException(
          'User collisions with legacy account are not allowed',
        );
      }

      if (user && user.accountType !== AccountType.SHIBBOLETH) {
        throw new BadRequestException(
          'User collisions with other account types are not allowed',
        );
      }

      if (user) {
        return user.id;
      }

      if (!user) {
        const newUser = await UserModel.create({
          email: mail,
          firstName: givenName,
          lastName: lastName,
          accountType: AccountType.SHIBBOLETH,
          emailVerified: true,
        }).save();

        const userId = newUser.id;

        await OrganizationUserModel.create({
          organizationId,
          userId: userId,
          role: OrganizationRole.MEMBER,
        }).save();

        await ChatTokenModel.create({
          user: newUser,
          token: v4(),
        }).save();

        await this.createStudentSubscriptions(userId);
        return userId;
      }

      throw new InternalServerErrorException('Unexpected error');
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async loginWithGoogle(
    auth_code: string,
    organizationId: number,
  ): Promise<number> {
    try {
      const { tokens } = await this.client.getToken(auth_code);

      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: `${process.env.GOOGLE_CLIENT_ID}.apps.googleusercontent.com`,
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

      if (user && user.password) {
        throw new BadRequestException(
          'User collisions with legacy account are not allowed',
        );
      }

      if (user && user.accountType !== AccountType.GOOGLE) {
        throw new BadRequestException(
          'User collisions with other account types are not allowed',
        );
      }

      if (user) {
        return user.id;
      }

      if (!user) {
        const newUser = await UserModel.create({
          email: payload.email,
          firstName: payload.given_name,
          lastName: payload.family_name,
          photoURL: payload.picture,
          accountType: AccountType.GOOGLE,
          emailVerified: true,
        }).save();

        const userId = newUser.id;

        await OrganizationUserModel.create({
          organizationId,
          userId: userId,
        }).save();

        await ChatTokenModel.create({
          user: newUser,
          token: v4(),
        }).save();

        await this.createStudentSubscriptions(userId);
        return userId;
      }

      throw new InternalServerErrorException('Unexpected error');
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  async register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    sid: number,
    organizationId: number,
  ): Promise<number> {
    try {
      const user = await UserModel.findOne({ email });

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

      const createdAt: number = parseInt(new Date().getTime().toString());
      const token: string = this.generateToken(8);

      await UserTokenModel.create({
        user: newUser,
        token: token,
        created_at: createdAt,
        expires_at: createdAt + 1000 * 60 * 60 * 24,
      }).save();

      await this.mailerService.sendUserVerificationCode(token, email);

      const userId = newUser.id;

      await OrganizationUserModel.create({
        organizationId,
        userId,
        role: OrganizationRole.MEMBER,
      }).save();

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
      relations: ['organizationUser'],
    });
    return user?.organizationUser?.organizationId == oid;
  }

  async createPasswordResetToken(user: UserModel): Promise<string> {
    const token = this.generateToken(12).toLowerCase();
    const createdAt = parseInt(new Date().getTime().toString());

    await UserTokenModel.create({
      user,
      token,
      created_at: createdAt,
      expires_at: createdAt + 1000 * 60 * 60 * 24,
      token_type: TokenType.PASSWORD_RESET,
    }).save();

    return token;
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
