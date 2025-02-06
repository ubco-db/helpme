import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { NotificationModule } from '../notification/notification.module';
import { LoginModule } from 'login/login.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { MailModule } from 'mail/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Module({
  imports: [
    NotificationModule,
    LoginModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    OrganizationModule,
    AuthModule,
  ],
  controllers: [ProfileController],
  providers: [JwtStrategy, AuthService],
})
export class ProfileModule {}
