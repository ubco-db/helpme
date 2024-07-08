import { Module } from '@nestjs/common';
import { RedisQueueService } from './redis-queue.service';

@Module({
  providers: [RedisQueueService],
  exports: [RedisQueueService],
})
export class RedisQueueModule {}
