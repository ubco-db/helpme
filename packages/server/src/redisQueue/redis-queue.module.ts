import { Module } from '@nestjs/common';
import { RedisQueueService } from './redis-queue.service';
import { RedisService } from 'nestjs-redis';

@Module({
  imports: [RedisService],
  providers: [RedisService, RedisQueueService],
  exports: [RedisService, RedisQueueService],
})
export class RedisQueueModule {}
