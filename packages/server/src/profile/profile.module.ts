import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { NotificationModule } from '../notification/notification.module';
import { ProfileService } from './profile.service';
import { LoginModule } from 'login/login.module';
import { JwtModule } from '@nestjs/jwt';
import { LoginCourseService } from 'login/login-course.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { MailModule } from 'mail/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { RedisProfileModule } from '../redisProfile/redis-profile.module';
import { RedisModule } from 'nestjs-redis';

@Module({
  imports: [
    NotificationModule,
    LoginModule,
    MailModule,
    RedisModule,
    RedisProfileModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    OrganizationModule,
  ],
  controllers: [ProfileController],
  providers: [
    JwtStrategy,
    ProfileService,
    RedisProfileService,
    LoginCourseService,
  ],
  exports: [ProfileService, RedisProfileService],
})
export class ProfileModule {}
