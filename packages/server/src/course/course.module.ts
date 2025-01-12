import { CacheModule, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { LoginCourseService } from '../login/login-course.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { HeatmapService } from './heatmap.service';
import { OrganizationModule } from 'organization/organization.module';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { QueueCleanService } from '../queue/queue-clean/queue-clean.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Module({
  controllers: [CourseController],
  imports: [
    QueueModule,
    LoginModule,
    AuthModule,
    CacheModule.register(),
    OrganizationModule,
    RedisQueueService,
  ],
  providers: [
    AuthService,
    LoginCourseService,
    HeatmapService,
    CourseService,
    RedisQueueService,
    ApplicationConfigService,
    QueueCleanService,
  ],
})
export class CourseModule {}
