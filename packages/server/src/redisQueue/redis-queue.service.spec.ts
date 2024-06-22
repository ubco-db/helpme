import { RedisModule } from 'nestjs-redis';
import { RedisQueueService } from './redis-queue.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { asyncQuestionStatus } from '@koh/common';
import Redis from 'ioredis';
import { Connection } from 'typeorm';

describe('RedisQueueService', () => {
  let service: RedisQueueService;
  let redis: Redis;
  let conn: Connection;

  beforeAll(async () => {
    redis = new Redis();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisQueueService],
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        RedisModule.register([
          { name: 'pub', host: process.env.REDIS_HOST || 'localhost' },
          { name: 'sub', host: process.env.REDIS_HOST || 'localhost' },
          { name: 'db', host: process.env.REDIS_HOST || 'localhost' },
        ]),
        RedisQueueService,
      ],
    }).compile();

    service = module.get<RedisQueueService>(RedisQueueService);
    conn = module.get<Connection>(Connection);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  afterEach(async () => {
    await redis.flushall();
    await conn.synchronize(true);
  });

  describe('setAsyncQuestions', () => {
    it('should set async questions', async () => {
      const asyncQuestionOne = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date(),
      }).save();

      const asyncQuestionTwo = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        createdAt: new Date(),
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
      }).save();

      const key = 'test:c:1:aq';

      const asyncQuestions = [asyncQuestionOne, asyncQuestionTwo];

      await service.setAsyncQuestions(key, asyncQuestions);
      expect(await redis.hgetall(key)).toBeDefined();
    });
  });

  describe('updateAsyncQuestion', () => {
    it('should update async question', async () => {
      const asyncQuestion = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date(),
      }).save();

      const key = 'test:c:1:aq';

      await service.updateAsyncQuestion(key, asyncQuestion);
      expect(await redis.hgetall(key)).toBeDefined();
    });
  });

  describe('deleteKey', () => {
    it('should delete key', async () => {
      const asyncQuestion = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date(),
      }).save();

      const key = 'test:c:1:aq';

      await service.addAsyncQuestion(key, asyncQuestion);
      expect(await redis.hgetall(key)).toBeDefined();

      await service.deleteKey(key);
      expect(await redis.hgetall(key)).toStrictEqual({});
    });
  });

  describe('setQuestions', () => {
    it('should set questions', async () => {
      const asyncQuestionOne = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date(),
      }).save();

      const asyncQuestionTwo = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        createdAt: new Date(),
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
      }).save();

      const key = 'test:c:1:aq';

      const asyncQuestions = [asyncQuestionOne, asyncQuestionTwo];

      await service.setQuestions(key, asyncQuestions);
      expect(await redis.hgetall(key)).toBeDefined();
    });
  });

  describe('deleteAsyncQuestion', () => {
    it('should delete async question', async () => {
      const asyncQuestion = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date(),
      }).save();

      const key = 'test:c:1:aq';

      await service.deleteAsyncQuestion(key, asyncQuestion);
      expect(await redis.hgetall(key)).toStrictEqual({});
    });
  });

  describe('addAsyncQuestion and getKey', () => {
    it('should add async question', async () => {
      const asyncQuestion = await AsyncQuestionModel.create({
        questionAbstract: 'questionAbstract',
        status: asyncQuestionStatus.AIAnswered,
        verified: false,
        visible: false,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      }).save();

      const key = 'test:c:1:aq';

      await service.addAsyncQuestion(key, asyncQuestion);
      expect(await redis.hgetall(key)).toBeDefined();

      expect(await service.getKey(key)).toStrictEqual({
        '1': {
          id: 1,
          questionAbstract: 'questionAbstract',
          status: 'AIAnswered',
          verified: false,
          visible: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          aiAnswerText: null,
          answerText: null,
          closedAt: null,
          courseId: null,
          creatorId: null,
          questionText: null,
          taHelpedId: null,
        },
      });
    });
  });
});
