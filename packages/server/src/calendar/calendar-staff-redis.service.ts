import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import * as zlib from 'zlib';

export type CalendarStaff = {
  userId: number;
  calendarId: number;
  username: string;
  startTime: Date;
  endTime: Date;
  startDate: Date;
  endDate: Date;
  daysOfWeek: string[];
};

@Injectable()
export class CalendarStaffRedisService {
  /**
   * The redis client to use for the redis queue
   */
  private readonly redis: Redis;

  /**
   * Constructor for the RedisQueueService
   * @param redisService {RedisService} The redis service to use for the redis queue
   */
  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient('db');
  }

  async setAllCalendarStaff(
    key: string,
    calendarStaff: CalendarStaff[],
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    calendarStaff.forEach((staff) => {
      const jsonStr = JSON.stringify(staff);
      const compressedData = zlib.gzipSync(jsonStr);
      const base64Encoded = compressedData.toString('base64');
      pipeline.hset(key, staff.userId + '-' + staff.calendarId, base64Encoded);
    });

    await pipeline.exec();
  }

  async setCalendarStaff(
    key: string,
    calendarStaff: CalendarStaff,
  ): Promise<void> {
    const jsonStr = JSON.stringify(calendarStaff);
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.hset(
      key,
      calendarStaff.userId + '-' + calendarStaff.calendarId,
      base64Encoded,
    );
  }

  async deleteCalendarStaff(
    key: string,
    userId: number,
    calendarId: number,
  ): Promise<void> {
    await this.redis.hdel(key, userId + '-' + calendarId);
  }

  async getCalendarStaff(key: string): Promise<Record<string, CalendarStaff>> {
    const data = await this.redis.hgetall(key);

    const result: Record<string, CalendarStaff> = {};

    Object.entries(data).forEach(([field, base64Encoded]) => {
      const compressedData = Buffer.from(base64Encoded, 'base64');
      const decompressedData = zlib.gunzipSync(compressedData).toString();
      result[field] = JSON.parse(decompressedData);
    });

    return result;
  }

  async getKeyCount(key: string): Promise<number> {
    return this.redis.hlen(key);
  }

  /**
   * Get async questions from the redis cache
   * @param key {string} The key name to get async questions from cache
   * @returns {Promise<Record<string, AsyncQuestionModel>>} A promise that resolves with the async questions from cache
   */
  async getKey(key: string): Promise<Record<string, any>> {
    const data = await this.redis.hgetall(key);

    const result: Record<string, any> = {};

    Object.entries(data).forEach(([field, base64Encoded]) => {
      const compressedData = Buffer.from(base64Encoded, 'base64');
      const decompressedData = zlib.gunzipSync(compressedData).toString();
      result[field] = JSON.parse(decompressedData);
    });

    return result;
  }

  async deleteKey(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
