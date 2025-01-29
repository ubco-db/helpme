import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
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

  async setProfile(
    key: string,
    profileResponse: GetProfileResponse,
  ): Promise<void> {
    const jsonStr = JSON.stringify(profileResponse);

    // Compress data since base64 encoding adds ~33% overhead
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.set(key, base64Encoded);
  }

  /**
   * Deletes a profile from cache given that hash set's key
   * @param key {string} The key name to specific profile from cache
   */
  async deleteProfile(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Fetches profile data from cache
   * @param key {string} The key name to specific profile from cache
   * @returns {Promise<Record<string, AsyncQuestionModel>>} A promise that resolves with the user data response from cache
   */
  async getKey(key: string): Promise<GetProfileResponse> {
    try {
      const data = JSON.parse(await this.redis.get(key));
      return data as GetProfileResponse;
    } catch (error) {
      return null;
    }
  }

  /**
   * Removes the whole hash set from cache
   * @param key {string} The key name to delete from cache
   */
  async deleteKey(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
