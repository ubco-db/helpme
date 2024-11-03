import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CalendarStaffRedisService } from './calendar-staff-redis.service';
import { QuestionService } from '../question/question.service';
import { NotificationService } from 'notification/notification.service';

@Module({
  controllers: [CalendarController],
  imports: [QueueModule, LoginModule],
  providers: [
    CalendarService,
    CalendarStaffRedisService,
    QuestionService,
    NotificationService,
  ],
})
export class CalendarModule {}
