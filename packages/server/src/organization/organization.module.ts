import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CourseService } from 'course/course.service';
import { MailService } from 'mail/mail.service';

@Module({
  imports: [RedisProfileModule, ScheduleModule.forRoot()],
  controllers: [OrganizationController],
  providers: [OrganizationService, MailService, CourseService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
