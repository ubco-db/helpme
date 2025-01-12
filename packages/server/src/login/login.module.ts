import { Module } from '@nestjs/common';
import { LoginController } from './login.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoginCourseService } from './login-course.service';
import { CourseService } from 'course/course.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

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
  providers: [JwtStrategy, LoginCourseService, CourseService, AuthService],
})
export class LoginModule {}
