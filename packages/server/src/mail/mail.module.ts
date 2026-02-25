import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigModule } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailServicesController } from './mail-services.controller';
import { UserModel } from 'profile/user.entity';
import { MailerService } from './mailer.service';

@Global()
@Module({
  controllers: [MailController, MailServicesController],
  imports: [ConfigModule],
  providers: [MailService, MailerService],
  exports: [MailService],
})
export class MailModule {}

export type sendEmailAsync = {
  receiver: string;
  subject: string;
  type: any;
};
@Module({
  controllers: [MailController, MailServicesController],
  providers: [
    {
      provide: MailService,
      // Use an empty class for a mock implementation
      useValue: {
        sendUserVerificationCode: async () => 'fake code',
        sendEmail: async (_emailPost: sendEmailAsync) => 'fake email',
        findAllSubscriptions: async (user: UserModel) => ['fake subscription'],
      },
    },
  ],
  exports: [MailService],
})
export class MailTestingModule {}
