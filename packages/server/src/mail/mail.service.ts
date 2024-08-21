import { MailServiceWithSubscription, sendEmailParams } from '@koh/common';
import { MailerService } from '@nestjs-modules/mailer';
import { MailServiceModel } from './mail-services.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import { UserSubscriptionModel } from './user-subscriptions.entity';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}
  APPLICATION_NAME = 'UBC HelpMe';
  async sendUserVerificationCode(
    code: string,
    receiver: string,
  ): Promise<void> {
    await this.mailerService.sendMail({
      to: receiver,
      from: `"${this.APPLICATION_NAME}" <no-reply@coursehelp.ubc.ca>`,
      subject: 'Verify your email address',
      text: `Your one time verification code is: ${code}`,
    });
  }

  async sendPasswordResetEmail(receiver: string, url: string): Promise<void> {
    await this.mailerService.sendMail({
      to: receiver,
      from: `"${this.APPLICATION_NAME}" <no-reply@coursehelp.ubc.ca>`,
      subject: 'Pasword Reset Request',
      text: `You are receiving this email because you (or someone else) has requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n
      ${url}\n\n`,
    });
  }

  async sendEmail(emailPost: sendEmailParams): Promise<void> {
    // if function is called, email should be sent
    // functions that call this function should previously check in user subscriptions and pass in emailPost.receiver
    // retrieve text to send based on emailPost.type
    const mail = await MailServiceModel.findOne({
      where: {
        name: emailPost.type,
      },
    });
    if (!mail) {
      throw new HttpException('Mail type/name not found', HttpStatus.NOT_FOUND);
    }

    await this.mailerService.sendMail({
      to: emailPost.receiver,
      from: '"UBC helpme support"',
      subject: emailPost.subject,
      html:
        mail.content +
        '<br> Check on : <a href="https://coursehelp.ubc.ca/">UBC Course Helper</a>',
    });
  }
  async findAll(
    role: string,
    user: UserModel,
  ): Promise<MailServiceWithSubscription[]> {
    // Fetch all mail services of the specified role
    const allMailServices = await MailServiceModel.find({
      where: { mailType: role },
    });

    // For each mail service, check if the user is subscribed and add 'isSubscribed' property
    const servicesWithSubscription = await Promise.all(
      allMailServices.map(async (mailService) => {
        const userSubscription = await UserSubscriptionModel.findOne({
          where: {
            serviceId: mailService.id,
            userId: user.id,
          },
        });
        return { ...mailService, isSubscribed: !!userSubscription };
      }),
    );
    return servicesWithSubscription;
  }

  async create(mailService: MailServiceModel): Promise<MailServiceModel> {
    return MailServiceModel.create(mailService).save();
  }

  async update(
    id: number,
    mailService: MailServiceModel,
  ): Promise<MailServiceModel> {
    await MailServiceModel.update({ id }, mailService);
    return MailServiceModel.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await MailServiceModel.delete({ id });
  }
}
