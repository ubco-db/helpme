import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import * as zlib from 'zlib';

@Injectable()
export class RedisQueueService {
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

  /**
   * Load all async questions from the redis cache
   * @param key {string} The key name to load async questions to cache
   * @param asyncQuestions {AsyncQuestionModel[]} The async questions to load to cache
   * @returns {Promise<void>} A promise that resolves when the async questions are loaded to cache
   */
  async setAsyncQuestions(
    key: string,
    asyncQuestions: AsyncQuestionModel[],
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    asyncQuestions.forEach((question) => {
      const jsonStr = JSON.stringify(question);
      const compressedData = zlib.gzipSync(jsonStr);
      const base64Encoded = compressedData.toString('base64');
      pipeline.hset(key, question.id, base64Encoded);
    });

    await pipeline.exec();
  }

  /**
   * Set questions in the redis cache
   * @param key {string} The key name to set the questions in cache
   * @param questions {any} The questions to set in cache
   */
  async setQuestions(key: string, questions: any): Promise<void> {
    const pipeline = this.redis.pipeline();

    const jsonStr = JSON.stringify(questions);
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');
    pipeline.hset(key, 'questions', base64Encoded);
    await pipeline.exec();
  }

  /**
   * Update an async question in the redis cache
   * @param key {string} The key name to update the async question in cache
   * @param asyncQuestion {AsyncQuestionModel} The async question to update in cache
   * @returns {Promise<void>} A promise that resolves when the async question is updated in cache
   */
  async updateAsyncQuestion(
    key: string,
    asyncQuestion: AsyncQuestionModel,
  ): Promise<void> {
    const jsonStr = JSON.stringify(asyncQuestion);
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.hset(key, asyncQuestion.id, base64Encoded);
  }

  /**
   * Delete an async question from the redis cache
   * @param key {string} The key name to delete the async question from cache
   * @param asyncQuestion {AsyncQuestionModel} The async question to delete from cache
   * @returns {Promise<void>} A promise that resolves when the async question is deleted from cache
   */
  async deleteAsyncQuestion(
    key: string,
    asyncQuestion: AsyncQuestionModel,
  ): Promise<void> {
    await this.redis.hdel(key, asyncQuestion.id.toString());
  }

  /**
   * Add an async question to the redis cache
   * @param key {string} The key name to add the async question to cache
   * @param asyncQuestion {AsyncQuestionModel} The async question to add to cache
   * @returns {Promise<void>} A promise that resolves when the async question is added to cache
   */
  async addAsyncQuestion(
    key: string,
    asyncQuestion: AsyncQuestionModel,
  ): Promise<void> {
    const jsonStr = JSON.stringify(asyncQuestion);

    // Compress data since base64 encoding adds ~33% overhead
    const compressedData = zlib.gzipSync(jsonStr);
    const base64Encoded = compressedData.toString('base64');

    await this.redis.hset(key, asyncQuestion.id, base64Encoded);
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
