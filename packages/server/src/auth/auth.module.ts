import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from 'login/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'mail/mail.module';
import { CourseService } from 'course/course.service';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationModule } from '../organization/organization.module';
import { LoginModule } from '../login/login.module';
import { LoginService } from '../login/login.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    MailModule,
    OrganizationModule,
    LoginModule,
    ChatbotModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    CourseService,
    RedisProfileService,
    OrganizationService,
    LoginService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
