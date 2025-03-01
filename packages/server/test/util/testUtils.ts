import { INestApplication, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
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
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { MailService } from 'mail/mail.service';

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
  entities: ['./**/*.entity.ts'],
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
): (u?: SupertestOptions) => supertest.SuperTest<supertest.Test> {
  let app: INestApplication;
  let jwtService: JwtService;
  let conn: Connection;
  let appConfig: ApplicationConfigService;
  let schedulerRegistry: SchedulerRegistry;

  beforeAll(async () => {
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
          { name: 'pub' },
          { name: 'sub' },
          { name: 'db' },
        ]),
      ],
    });

    if (modifyModule) {
      testModuleBuilder = modifyModule(testModuleBuilder);
    }
    const testModule = await testModuleBuilder.compile();

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
  });

  beforeEach(async () => {
    await conn.synchronize(true);
    await clearAllCronJobs(schedulerRegistry);
  });

  return (options?: SupertestOptions): supertest.SuperTest<supertest.Test> => {
    const agent = supertest.agent(app.getHttpServer());
    if (options?.userId) {
      const token = jwtService.sign({ userId: options.userId });
      agent.set('Cookie', [`auth_token=${token}`]);
    }
    return agent;
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
