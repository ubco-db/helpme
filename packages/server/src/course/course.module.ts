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
import { RedisProfileService } from '../redisProfile/redis-profile.service';

@Module({
  controllers: [CourseController],
  imports: [
    QueueModule,
    LoginModule,
    CacheModule.register(),
    OrganizationModule,
    RedisQueueService,
    RedisProfileService,
  ],
  providers: [
    LoginCourseService,
    HeatmapService,
    CourseService,
    RedisQueueService,
    RedisProfileService,
    ApplicationConfigService,
    QueueCleanService,
  ],
})
export class CourseModule {}
