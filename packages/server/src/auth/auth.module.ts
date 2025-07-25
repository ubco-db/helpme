import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from 'login/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'mail/mail.module';
import { CourseService } from 'course/course.service';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationModule } from '../organization/organization.module';

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
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    CourseService,
    RedisProfileService,
    ChatbotApiService,
    OrganizationService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
