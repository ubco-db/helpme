import { INestApplication, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule, RedisService } from 'nestjs-redis';
import { NotificationService } from 'notification/notification.service';
import * as supertest from 'supertest';
import { Connection } from 'typeorm';
import { addGlobalsToApp } from '../../src/bootstrap';
import { LoginModule } from '../../src/login/login.module';
import { ApplicationConfigService } from 'config/application_config.service';
import { ApplicationConfigModule } from 'config/application_config.module';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { MailService } from 'mail/mail.service';
import { RedisMemoryServer } from 'redis-memory-server';
import { Redis } from 'ioredis';

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;
export const TestTypeOrmModule = TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: process.env.POSTGRES_NONROOT_USER,
  password: process.env.POSTGRES_NONROOT_PASSWORD,
  database: 'test',
  entities: ['./**/*.entity.ts', '../../src/**/*.entity.ts'],
  synchronize: true,
  keepConnectionAlive: true,
});

export const TestConfigModule = ConfigModule.forRoot({
  envFilePath: ['.env.development'],
  isGlobal: true,
});

export function setupIntegrationTest(
  module: Type<any>,
  modifyModule?: ModuleModifier,
  additionalModules: Type<any>[] = [],
): {
  supertest: (u?: SupertestOptions) => supertest.SuperTest<supertest.Test>;
  getTestModule: () => TestingModule;
} {
  let app: INestApplication;
  let jwtService: JwtService;
  let conn: Connection;
  let appConfig: ApplicationConfigService;
  let schedulerRegistry: SchedulerRegistry;
  let testModule: TestingModule;
  let redisService: RedisService;

  let redisTestServer: RedisMemoryServer;
  let redisHost: string;
  let redisPort: number;

  beforeAll(async () => {
    if (!process.env.CI) {
      // For local testing, start a Redis in-memory server
      console.log('Starting Redis in-memory server');
      try {
        redisTestServer = new RedisMemoryServer();
        redisHost = await redisTestServer.getHost();
        redisPort = await redisTestServer.getPort();
      } catch (err) {
        console.error('Error initializing redis test container:', err);
        throw err;
      }
    } else {
      // For CI, use the provided Redis server from actions
      console.log(
        `Using CI Redis server: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      );
      redisHost = process.env.REDIS_HOST || 'localhost';
      redisPort = process.env.REDIS_PORT
        ? parseInt(process.env.REDIS_PORT)
        : 6379;
    }

    // Create the testing module
    let testModuleBuilder = Test.createTestingModule({
      imports: [
        ...additionalModules,
        module,
        LoginModule,
        TestTypeOrmModule,
        TestConfigModule,
        ApplicationConfigModule,
        ScheduleModule.forRoot(),
        RedisModule.register([
          { name: 'pub', host: redisHost, port: redisPort },
          { name: 'sub', host: redisHost, port: redisPort },
          { name: 'db', host: redisHost, port: redisPort },
        ]),
      ],
    });

    if (modifyModule) {
      testModuleBuilder = modifyModule(testModuleBuilder);
    }
    testModule = await testModuleBuilder.compile();

    // Create and configure the application

    app = testModule.createNestApplication();
    addGlobalsToApp(app);
    jwtService = testModule.get<JwtService>(JwtService);
    appConfig = testModule.get<ApplicationConfigService>(
      ApplicationConfigService,
    );
    conn = testModule.get<Connection>(Connection);
    redisService = testModule.get<RedisService>(RedisService);

    await appConfig.loadConfig();
    await app.init();
    schedulerRegistry = testModule.get<SchedulerRegistry>(SchedulerRegistry);

    // Ensure Redis is connected before proceeding
    await ensureRedisConnected(redisService.getClient('db'));
  }, 10000);

  afterAll(async () => {
    await app.close();
    await conn.close();
    await redisService.getClient('db').quit();

    if (redisTestServer) {
      await redisTestServer.stop();
    }
  });

  beforeEach(async () => {
    await conn.synchronize(true);
    await clearAllCronJobs(schedulerRegistry);
    await testModule.get<RedisService>(RedisService).getClient('db').flushall();
  });

  return {
    // Supertest agent
    supertest: (
      options?: SupertestOptions,
    ): supertest.SuperTest<supertest.Test> => {
      const agent = supertest.agent(app.getHttpServer());
      if (options?.userId) {
        const token = jwtService.sign({ userId: options.userId });
        agent.set('Cookie', [`auth_token=${token}`]);
      }
      return agent;
    },

    // Lazy getter for the test module since it is initialized in beforeAll block
    getTestModule: () => {
      if (!testModule) {
        throw new Error(
          'TestModule has not been initialized yet. Ensure `beforeAll` has run.',
        );
      }
      return testModule;
    },
  };
}

const notifMock = { notifyUser: jest.fn() };

/**
 * Module Modifier tests can pass to setupIntegrationTest to mock the notifService and to expect things
 * ex:
 * const supertest = setupIntegrationTest(QuestionModule, modifyMockNotifs);
 */

export const modifyMockNotifs: ModuleModifier = (t) =>
  t.overrideProvider(NotificationService).useValue(notifMock);
export const expectUserNotified = (userId: number): void =>
  expect(notifMock.notifyUser).toHaveBeenCalledWith(userId, expect.any(String));

export async function clearAllCronJobs(
  schedulerRegistry: SchedulerRegistry,
): Promise<void> {
  const cronJobs = schedulerRegistry.getCronJobs();
  cronJobs.forEach((_, jobName) => {
    schedulerRegistry.deleteCronJob(jobName);
  });
}

export const mockRedisQueueService = {
  setAsyncQuestions: jest.fn(),
  setQuestions: jest.fn(),
  updateAsyncQuestion: jest.fn(),
  deleteAsyncQuestion: jest.fn(),
  addAsyncQuestion: jest.fn(),
  getKey: jest.fn().mockResolvedValue([]),
  deleteKey: jest.fn(),
};

export const overrideRedisQueue: ModuleModifier = (builder) =>
  builder.overrideProvider(RedisQueueService).useValue(mockRedisQueueService);

export const mockEmailService = {
  sendEmail: jest.fn().mockImplementation(() => Promise.resolve()),
};

export const overrideEmailService: ModuleModifier = (builder) =>
  builder.overrideProvider(MailService).useValue(mockEmailService);
/* Takes an array of emails (receivers) and type of email (types)*/
export const expectEmailSent = (receivers: string[], types: string[]): void => {
  expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(receivers.length);
  const calls = mockEmailService.sendEmail.mock.calls.map((args) => args[0]);
  // expect that each receiver was sent an email of the correct type
  expect(calls).toEqual(
    expect.arrayContaining(
      receivers.map((item, i) =>
        expect.objectContaining({
          receiver: receivers[i],
          type: types[i],
        }),
      ),
    ),
  );
};
export const expectEmailNotSent = (): void =>
  expect(mockEmailService.sendEmail).not.toHaveBeenCalled();

async function ensureRedisConnected(redisClient: Redis, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const pingResponse = await redisClient.ping();
      if (pingResponse === 'PONG') {
        // Connected successfully, don't log anything
        return;
      }
    } catch (err) {
      console.warn(
        `Failed to establish connection to redis server. Retrying Redis connection... (${i + 1}/${retries})`,
      );
    }
    await new Promise((res) => setTimeout(res, 1000)); // Wait 1 second before retrying
  }
  throw new Error('Failed to connect to Redis after multiple attempts.');
}
