import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterSubscriber } from './semester.subscriber';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  controllers: [SemesterController],
  providers: [RedisProfileService, OrganizationService, SemesterSubscriber],
  imports: [OrganizationModule],
})
export class SemesterModule {}
