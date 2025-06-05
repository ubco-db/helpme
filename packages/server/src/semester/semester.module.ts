import { Module } from '@nestjs/common';
import { SemesterController } from './semester.controller';
import { SemesterSubscriber } from './semester.subscriber';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@Module({
  controllers: [SemesterController],
  providers: [RedisProfileService, SemesterSubscriber],
  imports: [],
})
export class SemesterModule {}
