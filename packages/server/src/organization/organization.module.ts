import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { RedisProfileModule } from 'redisProfile/redis-profile.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CourseService } from 'course/course.service';
import { MailModule } from 'mail/mail.module';
import { OrganizationUserSubscriber } from './organization-user.subscriber';
import { OrganizationSubscriber } from './organization.subscriber';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [
    RedisProfileModule,
    ScheduleModule.forRoot(),
    MailModule,
    ChatbotModule,
  ],
  controllers: [OrganizationController],
  providers: [
    OrganizationService,
    CourseService,
    OrganizationUserSubscriber,
    OrganizationSubscriber,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
