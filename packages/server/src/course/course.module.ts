import { CacheModule, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { LoginCourseService } from '../login/login-course.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { HeatmapService } from './heatmap.service';
import { OrganizationModule } from 'organization/organization.module';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { ApplicationConfigModule } from '../config/application_config.module';

@Module({
  controllers: [CourseController],
  imports: [
    QueueModule,
    LoginModule,
    CacheModule.register(),
    OrganizationModule,
    RedisQueueService,
  ],
  providers: [
    LoginCourseService,
    HeatmapService,
    CourseService,
    RedisQueueService,
    ApplicationConfigModule,
  ],
})
export class CourseModule {}
