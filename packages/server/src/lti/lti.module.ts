import { Module } from '@nestjs/common';
import { LtiController } from './lti.controller';
import { LtiService } from './lti.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisProfileModule } from '../redisProfile/redis-profile.module';
import { MailModule } from '../mail/mail.module';

@Module({
  controllers: [LtiController],
  providers: [LtiService],
  imports: [
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
