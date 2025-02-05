import { TestingModule, Test } from '@nestjs/testing';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { Connection } from 'typeorm';
import { TestTypeOrmModule, TestConfigModule } from '../../test/util/testUtils';
import { RedisModule, RedisService } from 'nestjs-redis';
import { GetProfileResponse, AccountType, UserRole } from '@koh/common';
import Redis from 'ioredis';

describe('RedisProfileService', () => {
  let service: RedisProfileService;
  let redis: Redis;
  let conn: Connection;

  beforeAll(async () => {
    redis = new Redis();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        RedisModule.register([
          { name: 'pub', host: process.env.REDIS_HOST || 'localhost' },
          { name: 'sub', host: process.env.REDIS_HOST || 'localhost' },
          { name: 'db', host: process.env.REDIS_HOST || 'localhost' },
        ]),
      ],
      providers: [RedisProfileService, RedisService],
    }).compile();

    service = module.get<RedisProfileService>(RedisProfileService);
    conn = module.get<Connection>(Connection);
  });

  afterEach(async () => {
    await redis.flushall();
    await conn.synchronize(true);
  });

  afterAll(async () => {
    await conn.close();
    redis.disconnect();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setProfile and getKey', () => {
    it('should set and retrieve a profile', async () => {
      const key = 'test:user:profile:1';
      const profile: GetProfileResponse = {
        id: 1,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        name: 'John Doe',
        photoURL: 'https://example.com/avatar.jpg',
        defaultMessage: 'Hello, welcome!',
        sid: 123456,
        includeDefaultMessage: true,
        courses: [],
        pendingCourses: [],
        desktopNotifsEnabled: true,
        desktopNotifs: [],
        insights: ['Dashboard'],
        userRole: UserRole.USER,
        organization: undefined,
        chat_token: {
          id: 1,
          token: 'sample-chat-token',
          used: 0,
          max_uses: 5,
        },
        accountType: AccountType.LEGACY,
        emailVerified: true,
        readChangeLog: false,
      };

      await service.setProfile(key, profile);
      expect(await redis.get(key)).toBeDefined();

      const cachedProfile = await service.getKey(key);
      expect(cachedProfile).toEqual(profile);
    });

    it('should return null if profile does not exist', async () => {
      const key = 'test:user:profile:nonexistent';
      const cachedProfile = await service.getKey(key);
      expect(cachedProfile).toBeNull();
    });
  });

  describe('deleteProfile', () => {
    it('should delete a profile from cache', async () => {
      const key = 'test:user:profile:1';
      const profile: GetProfileResponse = {
        id: 2,
        email: 'jane.doe@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        name: 'Jane Doe',
        photoURL: 'https://example.com/avatar2.jpg',
        defaultMessage: 'Hey there!',
        sid: 654321,
        includeDefaultMessage: false,
        courses: [],
        pendingCourses: [],
        desktopNotifsEnabled: false,
        desktopNotifs: [],
        insights: ['Queues'],
        userRole: UserRole.ADMIN,
        organization: undefined,
        chat_token: {
          id: 2,
          token: 'sample-chat-token-2',
          used: 1,
          max_uses: 10,
        },
        accountType: AccountType.GOOGLE,
        emailVerified: false,
        readChangeLog: true,
      };

      await service.setProfile(key, profile);
      expect(await redis.get(key)).toBeDefined();

      await service.deleteProfile(key);
      const cachedProfile = await redis.get(key);
      expect(cachedProfile).toBeNull();
    });
  });
});
