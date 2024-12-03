import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { QuestionService } from '../question/question.service';
import { NotificationService } from '../notification/notification.service';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueCleanModule } from 'queue/queue-clean/queue-clean.module';
import { QueueCleanService } from 'queue/queue-clean/queue-clean.service';

@Module({
  controllers: [CalendarController],
  imports: [
    QueueModule,
    LoginModule,
    QueueCleanModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    CalendarService,
    QuestionService,
    NotificationService,
    QueueCleanService,
  ],
})
export class CalendarModule {}
