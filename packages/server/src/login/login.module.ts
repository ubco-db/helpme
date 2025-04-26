import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { JwtStrategy } from '../login/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseService } from 'course/course.service';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { MailModule } from 'mail/mail.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule, RedisProfileModule, MailModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    MailModule,
  ],
  controllers: [LoginController],
  providers: [JwtStrategy, CourseService, RedisProfileService],
})
export class LoginModule {}
