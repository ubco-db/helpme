import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { NotificationModule } from '../notification/notification.module';
import { LoginModule } from 'login/login.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../login/jwt.strategy';
import { MailModule } from 'mail/mail.module';
import { OrganizationModule } from '../organization/organization.module';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { RedisProfileModule } from '../redisProfile/redis-profile.module';
import { ProfileService } from './profile.service';
import { ProfileSubscriber } from './profile.subscriber';
import { UserCourseSubscriber } from './user-course.subscriber';
import { UserTokenSubscriber } from './user-token.subscriber';

@Module({
  imports: [
    NotificationModule,
    LoginModule,
    MailModule,
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
    ProfileSubscriber,
    UserCourseSubscriber,
    UserTokenSubscriber,
  ],
  exports: [ProfileService, RedisProfileService],
})
export class ProfileModule {}
