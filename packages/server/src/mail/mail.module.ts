import { MailerModule } from '@nestjs-modules/mailer';
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailController } from './mail.controller';
import { MailServicesController } from './mail-services.controller';
import { UserModel } from 'profile/user.entity';
@Global()
@Module({
  controllers: [MailController, MailServicesController],
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          service: 'gmail',
          auth: {
            user: configService.get<string>('GMAIL_USER'),
            pass: configService.get<string>('GMAIL_PASSWORD'),
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
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
        sendUserVerificationCode: () => 'fake code',
        sendEmail: (_emailPost: sendEmailAsync) => 'fake email',
        findAllSubscriptions: (user: UserModel) => ['fake subscription'],
      },
    },
  ],
  exports: [MailService],
})
export class MailTestingModule {}
