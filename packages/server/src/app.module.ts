/* eslint-disable @typescript-eslint/no-unused-vars */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsightsModule } from './insights/insights.module';
import { AlertsModule } from './alerts/alerts.module';
import { BackfillModule } from './backfill/backfill.module';
import { CommandModule } from 'nestjs-command';
import { RedisModule } from 'nestjs-redis';
import * as typeormConfig from '../ormconfig';
import { AdminModule } from './admin/admin.module';
import { CourseModule } from './course/course.module';
import { CalendarModule } from './calendar/calendar.module';
import { HealthcheckModule } from './healthcheck/healthcheck.module';
import { LoginModule } from './login/login.module';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionModule } from './question/question.module';
import { QueueModule } from './queue/queue.module';
import { SeedModule } from './seed/seed.module';
import { SSEModule } from './sse/sse.module';
import { SemesterModule } from './semester/semester.module';
import { asyncQuestionModule } from './asyncQuestion/asyncQuestion.module';
import { MailModule } from './mail/mail.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { OrganizationModule } from './organization/organization.module';
import { QuestionTypeModule } from './questionType/questionType.module';
import { StudentTaskProgressModule } from './studentTaskProgress/studentTaskProgress.module';
import { RedisQueueModule } from 'redisQueue/redis-queue.module';
import { ApplicationConfigModule } from 'config/application_config.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { BackupModule } from 'backup/backup.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeormConfig),
    SentryModule.forRoot(),
    // Only use 'pub' for publishing events, 'sub' for subscribing, and 'db' for writing to key/value store
    RedisModule.register([
      { name: 'pub', host: process.env.REDIS_HOST || 'localhost' },
      { name: 'sub', host: process.env.REDIS_HOST || 'localhost' },
      { name: 'db', host: process.env.REDIS_HOST || 'localhost' },
    ]),
    ScheduleModule.forRoot(),
    ApplicationConfigModule,
    LoginModule,
    ProfileModule,
    CourseModule,
    QueueModule,
    NotificationModule,
    QuestionModule,
    SeedModule,
    MailModule,
    asyncQuestionModule,
    CalendarModule,
    ConfigModule.forRoot({
      envFilePath: [
        '.env',
        ...(process.env.NODE_ENV !== 'production' ? ['.env.development'] : []),
      ],
      isGlobal: true,
    }),
    AdminModule,
    CommandModule,
    SSEModule,
    BackfillModule,
    InsightsModule,
    HealthcheckModule,
    AlertsModule,
    SemesterModule,
    ChatbotModule,
    OrganizationModule,
    AuthModule,
    QuestionTypeModule,
    StudentTaskProgressModule,
    RedisQueueModule,
    BackupModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
  ],
})
export class AppModule {}
