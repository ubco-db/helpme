import { TestingModule, Test } from '@nestjs/testing';
import { LoginCourseService } from '../login/login-course.service';
import { Connection } from 'typeorm';
import { TestTypeOrmModule, TestConfigModule } from '../../test/util/testUtils';
import { ProfileService } from './profile.service';
import { MailService } from '../mail/mail.service';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { OrganizationService } from '../organization/organization.service';
import { RedisModule, RedisService } from 'nestjs-redis';
import Redis from 'ioredis';

jest.useRealTimers();

// Let's revisit theses tests later, we need to create new one since we changed a lot of the logic
describe('ProfileService', () => {
  let service: ProfileService;
  let conn: Connection;
  let redis: Redis;

  beforeAll(async () => {
    redis = new Redis();
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
      providers: [
        ProfileService,
        LoginCourseService,
        RedisService,
        RedisProfileService,
        OrganizationService,
        {
          // We disabled the mail service for now, so let's just mock it
          provide: MailService,
          useValue: {},
        },
      ],
    }).compile();
    service = module.get<ProfileService>(ProfileService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  // PAT TODO: replace with actual tests
  it('should confirm that 1+1 equals 2', () => {
    expect(1 + 1).toBe(2);
  });
});
