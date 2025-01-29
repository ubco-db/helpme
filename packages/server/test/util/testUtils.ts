import { INestApplication, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from 'nestjs-redis';
import { NotificationService } from 'notification/notification.service';
import * as supertest from 'supertest';
import { Connection } from 'typeorm';
import { addGlobalsToApp } from '../../src/bootstrap';
import { LoginModule } from '../../src/login/login.module';
import { ApplicationConfigService } from 'config/application_config.service';
import { ApplicationConfigModule } from 'config/application_config.module';
import { ScheduleModule, SchedulerRegistry } from '@nestjs/schedule';
import RedisMemoryServer from 'redis-memory-server';

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;
export const TestTypeOrmModule = TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: process.env.POSTGRES_USER || 'helpme',
  password: process.env.TESTDBPASS || 'mysecretpassword',
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

  let redisServer: RedisMemoryServer;
  let redisHost: string;
  let redisPort: number;

  beforeAll(async () => {
    // Start Redis in-memory server
    try {
      redisServer = new RedisMemoryServer();
      redisHost = await redisServer.getHost();
      redisPort = await redisServer.getPort();
    } catch (err) {
      console.error('Error initializing RedisMemoryServer:', err);
      throw err;
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

    await appConfig.loadConfig();
    await app.init();
    schedulerRegistry = testModule.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterAll(async () => {
    await app.close();
    await conn.close();
    if (redisServer) {
      await redisServer.stop();
    }
  });

  beforeEach(async () => {
    await conn.synchronize(true);
    await clearAllCronJobs(schedulerRegistry);
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
