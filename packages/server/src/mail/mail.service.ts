import {
  isProd,
  MailServiceWithSubscription,
  sendEmailParams,
  SentEmailResponse,
} from '@koh/common';
import { MailerService } from '@nestjs-modules/mailer';
import { MailServiceModel } from './mail-services.entity';
import { Injectable } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import * as fs from 'fs';
import { SentEmailModel } from './sent-email.entity';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}
  APPLICATION_NAME = 'HelpMe';
  async sendUserVerificationCode(
    code: string,
    receiver: string,
  ): Promise<void> {
    const from = `"${this.APPLICATION_NAME}" <no-reply@coursehelp.ubc.ca>`;
    const subject = 'Verify your email address';
    const text = `Your one time verification code is: ${code}`;
    if (!isProd()) {
      this.writeEmailToFile(receiver, subject, text);
      return;
    }
    await this.mailerService.sendMail({
      to: receiver,
      from,
      subject,
      text,
    });
  }

  async sendPasswordResetEmail(receiver: string, url: string): Promise<void> {
    const from = `"${this.APPLICATION_NAME}" <no-reply@coursehelp.ubc.ca>`;
    const subject = 'Password Reset Request';
    const text = `You are receiving this email because you (or someone else) has requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n
    ${url}\n\n`;
    if (!isProd()) {
      this.writeEmailToFile(receiver, subject, text);
      return;
    }
    await this.mailerService.sendMail({
      to: receiver,
      from,
      subject,
      text,
    });
  }

  /* Used for testing purposes. Allows you to write an email to a file instead of sending it */
  writeEmailToFile(
    email: string | string[],
    subject: string,
    content: string,
  ): void {
    try {
      const logFile = './src/mail/sent_dev_emails.log';
      const logStream = fs.createWriteStream(logFile, { flags: 'a' });
      logStream.write(`
        New email. Sent at ${new Date().toISOString()}
        Subject: ${subject}
        To: ${email}
        ${content}
        \n\n`);
      logStream.end();
      console.log(
        `Email written to sent_dev_emails.log inside /server/src/mail/sent_dev_emails.log`,
        email,
        subject,
      );
    } catch (err) {
      console.error('Error writing email to file:', err);
    }
  }

  /*  if function is called, email should be sent.
    functions that call this function should previously check in user subscriptions and pass in emailPost.receiver
    */
  async sendEmail(emailPost: sendEmailParams): Promise<void> {
    const baseContent = emailPost.content;
    const fullContent = `
    ${baseContent}
    <br><br><a href="${process.env.DOMAIN}/courses">View Your Courses</a>
    <br>Do you not want to receive these emails? <a href="${process.env.DOMAIN}/profile?page=notifications">Unsubscribe</a>
  `;
    // if on dev write to a file instead of actually sending an email (comment this out if you want to test sending emails, but be careful not to send emails to our userbase)
    if (!isProd()) {
      this.writeEmailToFile(
        emailPost.receiverOrReceivers,
        emailPost.subject,
        fullContent,
      );
      return;
    }

    const result: SentEmailResponse = await this.mailerService.sendMail({
      to: emailPost.receiverOrReceivers,
      from: '"HelpMe Support"',
      subject: emailPost.subject,
      html: fullContent,
      inReplyTo: emailPost.replyId,
      references: emailPost.replyId,
    });

    if (emailPost.track && result) {
      await SentEmailModel.create({
        emailId: result.messageId,
        accepted: result.accepted ?? [],
        rejected: result.rejected ?? [],
        metadata: emailPost.metadata,
        serviceType: emailPost.type,
      }).save();
    }
  }

  async replyToSentEmail(
    sentEmail: SentEmailModel,
    content?: string,
  ): Promise<void> {
    await SentEmailModel.delete({ emailId: sentEmail.emailId });
    await this.sendEmail({
      subject: `Re: ${sentEmail.subject}`,
      content,
      receiverOrReceivers: sentEmail.accepted,
      type: sentEmail.serviceType,
      replyId: sentEmail.emailId,
    });
  }

  async findAllSubscriptions(
    user: UserModel,
  ): Promise<MailServiceWithSubscription[]> {
    const mailServicesQuery = MailServiceModel.createQueryBuilder(
      'mailService',
    ).leftJoinAndSelect(
      'mailService.subscriptions',
      'subscription',
      'subscription.userId = :userId',
      { userId: user.id },
    );

    const mailServicesWithSubscriptions = await mailServicesQuery.getMany();

    // Map the results to the desired output format
    const servicesWithSubscription: MailServiceWithSubscription[] =
      mailServicesWithSubscriptions.map((mailService) => ({
        id: mailService.id,
        mailType: mailService.mailType,
        serviceType: mailService.serviceType,
        name: mailService.name,
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
    return MailServiceModel.findOne({
      where: {
        id: id,
      },
    });
  }

  async remove(id: number): Promise<void> {
    await MailServiceModel.delete({ id });
  }
}
