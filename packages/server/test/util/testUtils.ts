import { INestApplication, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from 'notification/notification.service';
import * as supertest from 'supertest';
import { DataSource } from 'typeorm';
import { addGlobalsToApp } from '../../src/bootstrap';
import { LoginModule } from '../../src/login/login.module';
import { ApplicationConfigService } from 'config/application_config.service';
import { ApplicationConfigModule } from 'config/application_config.module';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { MailService } from 'mail/mail.service';
import { RedisMemoryServer } from 'redis-memory-server';
import { Redis } from 'ioredis';
import { RedisModule, RedisService } from '@liaoliaots/nestjs-redis';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import {
  CourseFactory,
  initFactoriesFromService,
  QueueFactory,
  UserFactory,
} from './factories';
import { BaseExceptionFilter } from 'exception_filters/generic-exception.filter';
import { APP_FILTER } from '@nestjs/core';
import { Role } from '@koh/common';
import { UserCourseModel } from 'profile/user-course.entity';

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;
export const TestTypeOrmConfig: PostgresConnectionOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: process.env.POSTGRES_NONROOT_USER,
  password: process.env.POSTGRES_NONROOT_PASSWORD,
  database: 'test',
  entities: ['./**/*.entity.ts', '../../src/**/*.entity.ts'],
  synchronize: true,
};
export const TestTypeOrmModule = TypeOrmModule.forRoot(TestTypeOrmConfig);

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
  let dataSource: DataSource;
  let appConfig: ApplicationConfigService;
  let schedulerRegistry: SchedulerRegistry;
  let testModule: TestingModule;
  let redisService: RedisService;

  let redisTestServer: RedisMemoryServer;
  let redisHost: string;
  let redisPort: number;

  beforeAll(async () => {
    // TODO: fix RedisMemoryServer so that it works and we don't need to use our local redis server
    // if (!process.env.CI) {
    //   // For local testing, start a Redis in-memory server
    //   console.log('Starting Redis in-memory server');
    //   try {
    //     redisTestServer = new RedisMemoryServer();
    //     redisHost = await redisTestServer.getHost();
    //     redisPort = await redisTestServer.getPort();
    //   } catch (err) {
    //     console.error('Error initializing redis test container:', err);
    //     throw err;
    //   }
    // } else {
    // For CI, use the provided Redis server from actions
    console.log(
      `Using CI Redis server: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    );
    redisHost = process.env.REDIS_HOST || 'localhost';
    redisPort = process.env.REDIS_PORT
      ? parseInt(process.env.REDIS_PORT)
      : 6379;
    // }

    // Create the testing module
    let testModuleBuilder = Test.createTestingModule({
      imports: [
        ...additionalModules,
        module,
        LoginModule,
        TestTypeOrmModule,
        TestConfigModule,
        ApplicationConfigModule,
        FactoryModule,
        ScheduleModule.forRoot(),
        RedisModule.forRoot({
          readyLog: false,
          errorLog: true,
          commonOptions: {
            host: redisHost,
            port: redisPort,
          },
          config: [
            {
              namespace: 'db',
            },
            {
              namespace: 'sub',
            },
            {
              namespace: 'pub',
            },
          ],
        }),
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: BaseExceptionFilter,
        },
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
    dataSource = testModule.get<DataSource>(DataSource);
    redisService = testModule.get<RedisService>(RedisService);

    await appConfig.loadConfig();
    await app.init();
    schedulerRegistry = testModule.get<SchedulerRegistry>(SchedulerRegistry);

    // Grab FactoriesService from Nest
    const factories = testModule.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);

    // Ensure Redis is connected before proceeding
    await ensureAllRedisConnected(redisService);
  }, 10000);

  afterAll(async () => {
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }

    // Close all Redis connections
    try {
      const redisClients = ['db', 'pub', 'sub'];
      for (const namespace of redisClients) {
        const client = redisService.getClient(namespace);
        if (client && client.status === 'ready') {
          await client.quit();
        }
      }
    } catch (err) {
      if (err != 'Error: Connection is closed.') {
        console.warn('Error closing Redis connections:', err);
      }
    }

    if (redisTestServer) {
      await redisTestServer.stop();
    }
  }, 10000);

  beforeEach(async () => {
    await dataSource.synchronize(true);
    await clearAllCronJobs(schedulerRegistry);

    // Flush all Redis databases
    const namespaces = ['db', 'pub', 'sub'];
    for (const namespace of namespaces) {
      try {
        const client = redisService.getClient(namespace);
        if (client && client.status === 'ready') {
          await client.flushall();
        }
      } catch (err) {
        console.warn(`Error flushing Redis namespace ${namespace}:`, err);
      }
    }
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

const mockSendEmail = jest.fn().mockImplementation(() => Promise.resolve());
export const mockEmailService = {
  sendEmail: mockSendEmail,
  replyToSentEmail: jest.fn().mockImplementation((sentEmail, content) => {
    mockSendEmail({
      subject: `Re: ${sentEmail.subject}`,
      content,
      receiverOrReceivers: sentEmail.accepted,
      type: sentEmail.serviceType,
      replyId: sentEmail.emailId,
    });
  }),
};

export const overrideEmailService: ModuleModifier = (builder) =>
  builder.overrideProvider(MailService).useValue(mockEmailService);
/* Takes an array of emails (receivers) and type of email (types)*/
export const expectEmailSent = (
  receivers: (string | string[])[],
  types: string[],
): void => {
  expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(receivers.length);
  const calls = mockEmailService.sendEmail.mock.calls.map((args) => args[0]);
  // expect that each receiver was sent an email of the correct type
  expect(calls).toEqual(
    expect.arrayContaining(
      receivers.map((item, i) =>
        expect.objectContaining({
          receiverOrReceivers: receivers[i],
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
        return true;
      }
    } catch (err) {
      console.warn(
        `Failed to establish connection to redis server. Retrying Redis connection... (${i + 1}/${retries})`,
      );
    }
    await new Promise((res) => setTimeout(res, 1000)); // Wait 1 second before retrying
  }
  return false;
}

// Helper to ensure all Redis connections are ready
async function ensureAllRedisConnected(
  redisService: RedisService,
  retries = 5,
): Promise<void> {
  const namespaces = ['db', 'pub', 'sub'];
  const results = await Promise.all(
    namespaces.map(async (namespace) => {
      try {
        const client = redisService.getClient(namespace);
        return await ensureRedisConnected(client, retries);
      } catch (err) {
        console.warn(`Error connecting to Redis namespace ${namespace}:`, err);
        return false;
      }
    }),
  );

  if (results.some((result) => !result)) {
    console.warn(
      'Some Redis connections could not be established. Tests may fail.',
    );
  }
}

export const failedPermsCheckForCourse = async (
  route: (courseId: number) => string,
  courseRole: Role,
  method: 'GET' | 'POST' | 'DELETE',
  supertest: (
    options?: SupertestOptions,
  ) => supertest.SuperTest<supertest.Test>,
) => {
  const user = await UserFactory.create();
  const course = await CourseFactory.create();

  await UserCourseModel.create({
    userId: user.id,
    courseId: course.id,
    role: courseRole,
  }).save();

  const sp = supertest({ userId: user.id });
  const path = route(course.id);
  let res: any;
  switch (method) {
    case 'DELETE':
      res = await sp.delete(path);
      break;
    case 'GET':
      res = await sp.get(path);
      break;
    case 'POST':
      res = await sp.post(path);
      break;
  }
  if (res.statusCode !== 403) {
    // failing test
    console.error(res.body);
  }
  expect(res.statusCode).toBe(403);
};

export const failedPermsCheckForQueue = async (
  route: (queueId: number) => string,
  courseRole: Role,
  method: 'GET' | 'POST' | 'DELETE',
  supertest: (
    options?: SupertestOptions,
  ) => supertest.SuperTest<supertest.Test>,
) => {
  const user = await UserFactory.create();
  const course = await CourseFactory.create();
  const queue = await QueueFactory.create({ course: course });

  await UserCourseModel.create({
    userId: user.id,
    courseId: course.id,
    role: courseRole,
  }).save();

  const sp = supertest({ userId: user.id });
  const path = route(queue.id);
  let res: any;
  switch (method) {
    case 'DELETE':
      res = await sp.delete(path);
      break;
    case 'GET':
      res = await sp.get(path);
      break;
    case 'POST':
      res = await sp.post(path);
      break;
  }
  if (res.statusCode !== 403) {
    // failing test
    console.error(res.body);
  }
  expect(res.statusCode).toBe(403);
};

// TODO: add a function for not allowing someone to access a route because they are not in the course (said function will need to be passed what a successful call would look like and then just call it from another user who is in the same or but different course).

// TODO: Add some functions for calling routes with bad data to make sure said data isn't being accepted.
// Idk exactly how to go about it, but I know one thing that can be broken is typeorm if you pass it the name of entities that are null, which would cause errors.
// Could also try to call with a bunch of the correct properties but all booleans or all strings or something.
