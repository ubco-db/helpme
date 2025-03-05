import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { HeatmapService } from './heatmap.service';
import { OrganizationModule } from 'organization/organization.module';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { QueueCleanService } from '../queue/queue-clean/queue-clean.service';
import { ApplicationConfigModule } from '../config/application_config.module';
import { RedisQueueModule } from '../redisQueue/redis-queue.module';

@Module({
  controllers: [CourseController],
  imports: [
    QueueModule,
    LoginModule,
    CacheModule.register(),
    OrganizationModule,
    RedisQueueModule,
    ApplicationConfigModule,
  ],
  providers: [
    HeatmapService,
    CourseService,
    RedisQueueService,
    QueueCleanService,
    ApplicationConfigService,
  ],
})
export class CourseModule {}
