import { MailerModule } from '@nestjs-modules/mailer';
import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailController } from './mail.controller';
import { sendEmailAsync } from '@koh/common';
@Global()
@Module({
  controllers: [MailController],
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

@Module({
  controllers: [MailController],
  providers: [
    {
      provide: MailService,
      // Use an empty class for a mock implementation
      useValue: {
        sendUserVerificationCode: () => 'fake code',
        sendEmail: (_emailPost: sendEmailAsync) => 'fake email',
      },
    },
  ],
  exports: [MailService],
})
export class MailTestingModule {}
