import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import * as zlib from 'zlib';
import { GetProfileResponse } from '@koh/common';

@Injectable()
export class RedisProfileService {
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

  async updateProfile(
    key: string,
    profileResponse: AsyncQuestionModel,
  ): Promise<void> {
    const jsonStr = JSON.stringify(profileResponse);
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.hset(key, profileResponse.id, base64Encoded);
  }

  async deleteProfile(
    key: string,
    profileResponse: GetProfileResponse,
  ): Promise<void> {
    await this.redis.hdel(key, profileResponse.id.toString());
  }

  async addProfile(
    key: string,
    profileResponse: GetProfileResponse,
  ): Promise<void> {
    const jsonStr = JSON.stringify(profileResponse);
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.hset(key, profileResponse.id, base64Encoded);
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
