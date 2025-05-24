import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CourseService } from 'course/course.service';
import { MailModule } from 'mail/mail.module';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
@Module({
  imports: [RedisProfileModule, ScheduleModule.forRoot(), MailModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, CourseService, ChatbotApiService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
