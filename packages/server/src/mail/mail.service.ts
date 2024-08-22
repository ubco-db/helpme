import {
  MailServiceWithSubscription,
  OrganizationRole,
  Role,
  sendEmailParams,
} from '@koh/common';
import { MailerService } from '@nestjs-modules/mailer';
import { MailServiceModel } from './mail-services.entity';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import { UserCourseModel } from 'profile/user-course.entity';

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
        serviceType: emailPost.type,
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
  async findAllSubscriptions(
    user: UserModel,
  ): Promise<MailServiceWithSubscription[]> {
    // Check if the user is a professor in any course
    const isProfInAnyCourse = await UserCourseModel.findOne({
      where: {
        userId: user.id,
        role: Role.PROFESSOR,
      },
    });

    let mailServicesQuery = MailServiceModel.createQueryBuilder(
      'mailService',
    ).leftJoinAndSelect(
      'mailService.subscriptions',
      'subscription',
      'subscription.userId = :userId',
      { userId: user.id },
    );

    // If user is not a professor in any course, filter by MEMBER role
    if (!isProfInAnyCourse) {
      mailServicesQuery = mailServicesQuery.where(
        'mailService.mailType = :role',
        { role: OrganizationRole.MEMBER },
      );
    }

    const mailServicesWithSubscriptions = await mailServicesQuery.getMany();

    // Map the results to the desired output format
    const servicesWithSubscription: MailServiceWithSubscription[] =
      mailServicesWithSubscriptions.map((mailService) => ({
        id: mailService.id,
        mailType: mailService.mailType,
        serviceType: mailService.serviceType,
        name: mailService.name,
        content: mailService.content,
        isSubscribed:
          mailService.subscriptions.length > 0
            ? mailService.subscriptions[0].isSubscribed
            : false,
      }));

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
