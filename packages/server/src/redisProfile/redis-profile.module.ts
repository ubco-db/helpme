import { Module } from '@nestjs/common';
import { RedisProfileService } from './redis-profile.service';

@Module({
  providers: [RedisProfileService],
  exports: [RedisProfileService],
})
export class RedisProfileModule {}
