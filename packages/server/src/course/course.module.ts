import { CacheModule, Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { LoginModule } from '../login/login.module';
import { LoginCourseService } from '../login/login-course.service';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { HeatmapService } from './heatmap.service';
import { OrganizationModule } from '../organization/organization.module';
import { ApplicationConfigModule } from '../config/application_config.module';

@Module({
  controllers: [CourseController],
  imports: [
    QueueModule,
    LoginModule,
    CacheModule.register(),
    OrganizationModule,
    ApplicationConfigModule,
  ],
  providers: [LoginCourseService, HeatmapService, CourseService],
})
export class CourseModule {}
