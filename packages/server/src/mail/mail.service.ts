import { asyncQuestionEventType, sendEmailAsync } from '@koh/common';
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

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

  async sendEmail(emailPost: sendEmailAsync): Promise<void> {
    let text = null;
    if (emailPost.type === asyncQuestionEventType.answered) {
      text = 'Your async question is answered on UBC helpme';
    } else if (emailPost.type === asyncQuestionEventType.deleted) {
      text = 'Your async question has been deleted by the professor';
    } else if (emailPost.type === asyncQuestionEventType.created) {
      text = 'Async question created on UBC helpme ';
    }
    if (!text) {
    }
    await this.mailerService.sendMail({
      to: emailPost.receiver,
      from: '"UBC helpme support" <support@example.com>', // override default from
      subject: emailPost.subject,
      text: text + '\n Check on :  https://help.cosc304.ok.ubc.ca',
    });
  }
}
