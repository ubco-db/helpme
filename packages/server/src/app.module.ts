import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsightsModule } from './insights/insights.module';
import { AlertsModule } from './alerts/alerts.module';
import { BackfillModule } from './backfill/backfill.module';
import { CommandModule } from 'nestjs-command';
import * as typeormConfig from '../ormconfig';
import * as chatbotTypeORMConfig from '../chatbot_ormconfig';
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
import { ApplicationConfigModule } from './config/application_config.module';
import { SentryModule } from '@sentry/nestjs/setup';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { BackupModule } from 'backup/backup.module';
import { QueueChatsModule } from 'queueChats/queue-chats.module';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RateLimitExceptionFilter } from 'exception_filters/429-exception.filter';
import { LmsIntegrationModule } from './lmsIntegration/lmsIntegration.module';
import { BaseExceptionFilter } from 'exception_filters/generic-exception.filter';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...typeormConfig,
    }),
    SentryModule.forRoot(),
    // Only use 'pub' for publishing events, 'sub' for subscribing, and 'db' for writing to key/value store
    RedisModule.forRoot({
      readyLog: true,
      errorLog: true,
      commonOptions: {
        host: process.env.REDIS_HOST || 'localhost',
        port: 6379,
      },
      config: [
        {
          namespace: 'db',
        },
        {
          namespace: 'sub',
        },
        {
          namespace: 'pub',
        },
      ],
    }),
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
    QueueChatsModule,
    // no more than 30 calls per 1 second
    ThrottlerModule.forRoot([
      {
        ttl: seconds(1),
        limit: 30,
      },
    ]),
    LmsIntegrationModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: BaseExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: RateLimitExceptionFilter, // for capturing 429 too many request errors
    },
  ],
})
export class AppModule {}
