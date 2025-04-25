import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CourseModule } from 'course/course.module';
import { CourseService } from 'course/course.service';
import { MailModule } from 'mail/mail.module';

@Module({
  imports: [RedisProfileModule, ScheduleModule.forRoot()],
  controllers: [OrganizationController],
  providers: [OrganizationService, CourseService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
