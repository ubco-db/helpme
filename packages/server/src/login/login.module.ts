import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseService } from 'course/course.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    AuthModule,
  ],
  controllers: [LoginController],
  providers: [JwtStrategy, CourseService],
})
export class LoginModule {}
