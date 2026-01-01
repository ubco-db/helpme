import { Module } from '@nestjs/common';
import { LtiController } from './lti.controller';
import { LtiService } from './lti.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisProfileModule } from '../redisProfile/redis-profile.module';
import { MailModule } from '../mail/mail.module';
import { LtiAuthController } from './lti-auth.controller';
import { LoginModule } from '../login/login.module';
import { LoginService } from '../login/login.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  controllers: [LtiController, LtiAuthController],
  providers: [LtiService, LoginService, AuthService],
  imports: [
    AuthModule,
    OrganizationModule,
    LoginModule,
    JwtModule.registerAsync({
      imports: [ConfigModule, RedisProfileModule, MailModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
  ],
})
export class LtiModule {}
