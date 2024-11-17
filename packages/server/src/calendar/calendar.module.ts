import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { QuestionService } from '../question/question.service';
import { NotificationService } from '../notification/notification.service';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  controllers: [CalendarController],
  imports: [QueueModule, LoginModule, ScheduleModule.forRoot()],
  providers: [CalendarService, QuestionService, NotificationService],
})
export class CalendarModule {}
