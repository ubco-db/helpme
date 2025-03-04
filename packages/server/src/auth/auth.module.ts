import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from 'login/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from 'mail/mail.service';
import { MailModule } from 'mail/mail.module';
import { CourseService } from 'course/course.service';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

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
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    AuthService,
    MailService,
    CourseService,
    RedisProfileService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
