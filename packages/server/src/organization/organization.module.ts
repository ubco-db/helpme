import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CourseService } from 'course/course.service';
import { MailService } from 'mail/mail.service';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
@Module({
  imports: [RedisProfileModule, ScheduleModule.forRoot(), MailService],
  controllers: [OrganizationController],
  providers: [OrganizationService, CourseService, ChatbotApiService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
