import { INestApplication, Module, Type } from '@nestjs/common';
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
import { BullModule } from '@nestjs/bullmq';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { MailService } from 'mail/mail.service';
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
import { ChatbotController } from '../../src/chatbot/chatbot.controller';
import { CacheModule } from '@nestjs/cache-manager';
import { ChatbotService } from '../../src/chatbot/chatbot.service';
import { ChatbotApiService } from '../../src/chatbot/chatbot-api.service';
import { ChatbotDataSourceModule } from '../../src/chatbot/chatbot-datasource/chatbot-datasource.module';
import { Role } from '@koh/common';
import { UserCourseModel } from 'profile/user-course.entity';
import express, { Locals, Response } from 'express';
import { CookieOptions } from 'express-serve-static-core';
import {
  getTestBullPrefix,
  getTestDatabaseName,
  getTestRedisDb,
} from '../setup/testEnvironment';

// Re-exported for specs that build their own Redis modules/clients.
export { getTestRedisDb };

export interface SupertestOptions {
  userId?: number;
}
export type ModuleModifier = (t: TestingModuleBuilder) => TestingModuleBuilder;
export const TestTypeOrmConfig: PostgresConnectionOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_NONROOT_USER,
  password: process.env.POSTGRES_NONROOT_PASSWORD,
  database: getTestDatabaseName('test'),
  entities: ['./**/*.entity.ts', '../../src/**/*.entity.ts'],
  synchronize: true,
  // Parallel workers each own a DataSource (plus a chatbot DataSource), so keep
  // pools small to stay well under PostgreSQL's default max_connections of 100.
  extra: { max: 4, connectionTimeoutMillis: 10000 }, // max 4 connections. Kept small on purpose for tests (that way it can help expose leaks before it reaches prod).
};
export const TestTypeOrmModule = TypeOrmModule.forRoot(TestTypeOrmConfig);

export const TestChatbotConnectionOptions: PostgresConnectionOptions = {
  ...TestTypeOrmConfig,
  database: getTestDatabaseName('chatbot_test'),
  entities: undefined,
  extra: { max: 2, connectionTimeoutMillis: 10000 }, // max 2 connections. Kept small on purpose for tests (that way it can help expose leaks before it reaches prod).
};

interface ForeignKeyEdge {
  id: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  /** True when every child column is nullable, so the edge can be broken. */
  nullable: boolean;
}

interface DatabaseResetPlan {
  updates: string[];
  deletes: string[];
  truncateTables: string[];
  sequences: string[];
}

const resetPlans = new WeakMap<DataSource, DatabaseResetPlan>();

/** Surrounds the identifier with double quotes, escaping any existing quotes. */
const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

/** Tarjan's strongly connected components algorithm. */
function findStronglyConnectedComponents(
  nodes: string[],
  edges: ForeignKeyEdge[],
): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.childTable)?.push(edge.parentTable);
  }

  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (node: string): void => {
    indices.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex++;
    stack.push(node);
    onStack.add(node);

    for (const neighbour of adjacency.get(node) ?? []) {
      if (!indices.has(neighbour)) {
        visit(neighbour);
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), lowLinks.get(neighbour)),
        );
      } else if (onStack.has(neighbour)) {
        lowLinks.set(
          node,
          Math.min(lowLinks.get(node), indices.get(neighbour)),
        );
      }
    }

    if (lowLinks.get(node) === indices.get(node)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);
      components.push(component);
    }
  };

  for (const node of nodes) {
    if (!indices.has(node)) {
      visit(node);
    }
  }
  return components;
}

function findCyclicTables(
  nodes: string[],
  edges: ForeignKeyEdge[],
): Set<string> {
  const cyclicTables = new Set<string>();
  for (const component of findStronglyConnectedComponents(nodes, edges)) {
    if (component.length > 1) {
      component.forEach((table) => cyclicTables.add(table));
    } else {
      const table = component[0];
      if (
        edges.some(
          (edge) => edge.childTable === table && edge.parentTable === table,
        )
      ) {
        cyclicTables.add(table);
      }
    }
  }
  return cyclicTables;
}

/**
 * Builds a plan that empties every table in the test database.
 *
 * `dataSource.synchronize(true)` (drop + recreate every table) and even
 * `TRUNCATE` are surprisingly slow on Docker/overlay filesystems: dropping or
 * recreating relation files costs ~1-2 seconds per test. `DELETE FROM` is
 * ~100x cheaper, but foreign keys require deleting children before parents and
 * a few entities have circular references.
 *
 * The plan therefore:
 *   1. finds foreign-key cycles,
 *   2. breaks each cycle by nulling a nullable foreign-key column (if there is
 *      no nullable edge, that component falls back to TRUNCATE),
 *   3. topologically sorts the remaining tables so children are deleted first.
 */
async function buildDatabaseResetPlan(
  dataSource: DataSource,
): Promise<DatabaseResetPlan> {
  const tableRows: { tablename: string }[] = await dataSource.query(
    `SELECT tablename
       FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT IN ('typeorm_metadata', 'migrations')`,
  );
  const tables = tableRows.map(({ tablename }) => tablename);
  if (tables.length === 0) {
    return { updates: [], deletes: [], truncateTables: [], sequences: [] };
  }

  const edgeRows: {
    id: string;
    childTable: string;
    childColumns: string[];
    parentTable: string;
    nullable: boolean;
  }[] = await dataSource.query(
    `SELECT child.relname || ':' || con.conname AS id,
            child.relname AS "childTable",
            json_agg(chcol.attname ORDER BY ck.ord) AS "childColumns",
            parent.relname AS "parentTable",
            bool_and(NOT chcol.attnotnull) AS nullable
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace n ON n.oid = child.relnamespace
       JOIN LATERAL unnest(con.conkey) WITH ORDINALITY ck(attnum, ord) ON true
       JOIN LATERAL unnest(con.confkey) WITH ORDINALITY pk(attnum, ord)
         ON pk.ord = ck.ord
       JOIN pg_attribute chcol
         ON chcol.attrelid = child.oid AND chcol.attnum = ck.attnum
      WHERE con.contype = 'f' AND n.nspname = 'public'
      GROUP BY con.conname, child.relname, parent.relname`,
  );

  const tableSet = new Set(tables);
  const edges = edgeRows.filter(
    (edge) => tableSet.has(edge.childTable) && tableSet.has(edge.parentTable),
  );

  // Break cycles using nullable foreign keys wherever possible.
  const nulledEdges = new Set<string>();
  let activeEdges = edges;
  let cyclicTables = findCyclicTables(tables, activeEdges);
  while (cyclicTables.size > 0) {
    const removableEdges = activeEdges.filter(
      (edge) =>
        edge.nullable &&
        cyclicTables.has(edge.childTable) &&
        cyclicTables.has(edge.parentTable),
    );
    if (removableEdges.length === 0) {
      break;
    }
    for (const edge of removableEdges) {
      nulledEdges.add(edge.id);
    }
    activeEdges = activeEdges.filter((edge) => !nulledEdges.has(edge.id));
    cyclicTables = findCyclicTables(tables, activeEdges);
  }

  const updates = edges
    .filter((edge) => nulledEdges.has(edge.id))
    .map((edge) => {
      const setClause = edge.childColumns
        .map((column) => `${quoteIdentifier(column)} = NULL`)
        .join(', ');
      const whereClause = edge.childColumns
        .map((column) => `${quoteIdentifier(column)} IS NOT NULL`)
        .join(' OR ');
      return `UPDATE ${quoteIdentifier(edge.childTable)} SET ${setClause} WHERE ${whereClause};`;
    });

  // Tables still in a cycle after nulling nullable edges are cleared with
  // TRUNCATE CASCADE (rare; the current schema does not need it).
  const truncateTables = [...cyclicTables];
  const truncateSet = new Set(truncateTables);
  const deleteTables = tables.filter((table) => !truncateSet.has(table));

  const childrenOf = new Map<string, string[]>();
  for (const table of deleteTables) {
    childrenOf.set(table, []);
  }
  for (const edge of activeEdges) {
    if (
      !truncateSet.has(edge.childTable) &&
      !truncateSet.has(edge.parentTable)
    ) {
      childrenOf.get(edge.parentTable)?.push(edge.childTable);
    }
  }

  const orderedTables: string[] = [];
  const visited = new Set<string>();
  const visit = (table: string): void => {
    if (visited.has(table)) {
      return;
    }
    visited.add(table);
    for (const child of childrenOf.get(table) ?? []) {
      visit(child);
    }
    orderedTables.push(table);
  };
  for (const table of deleteTables) {
    visit(table);
  }

  const sequenceRows: { sequencename: string }[] = await dataSource.query(
    `SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'`,
  );

  return {
    updates,
    deletes: orderedTables.map(
      (table) => `DELETE FROM ${quoteIdentifier(table)};`,
    ),
    truncateTables,
    sequences: sequenceRows.map(({ sequencename }) => sequencename),
  };
}

/**
 * Clears every table in the test database while preserving auto-increment
 * behaviour (the next inserted row gets id 1, like the old
 * `dataSource.synchronize(true)` did).
 *
 * Reason: Performance. Both DROP TABLE and even TRUNCATE TABLE can be 100x slower than
 * DROP TABLE.
 *
 * Here's the full plan of what this does:
 * 1. Read the table list and foreign-key graph from `pg_catalog`.
 * 2. Find cycles (strongly connected components).
 * 3. Break cycles by nulling a nullable FK column where possible.
 * 4. Topologically sort the rest so children are deleted before parents.
 * 5. `DELETE FROM` everything in one transaction.
 * 6. Reset all sequences with `setval(..., 1, false)` so IDs restart at 1.
 *
 * If a cycle has no nullable edge, that component falls back to
 * `TRUNCATE ... CASCADE` (rare).
 */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  let plan = resetPlans.get(dataSource);
  if (!plan) {
    plan = await buildDatabaseResetPlan(dataSource);
    resetPlans.set(dataSource, plan);
  }

  if (plan.truncateTables.length > 0) {
    await dataSource.query(
      `TRUNCATE TABLE ${plan.truncateTables
        .map(quoteIdentifier)
        .join(', ')} CASCADE`,
    );
  }

  if (plan.updates.length > 0 || plan.deletes.length > 0) {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.startTransaction();
      await queryRunner.query([...plan.updates, ...plan.deletes].join('\n'));
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  if (plan.sequences.length > 0) {
    await dataSource.query(
      `SELECT ${plan.sequences
        .map(
          (sequence) =>
            `setval('${quoteIdentifier(sequence).replace(/'/g, "''")}', 1, false)`,
        )
        .join(', ')}`,
    );
  }
}
export const TestChatbotDataSourceModule = ChatbotDataSourceModule.forRoot(
  TestChatbotConnectionOptions,
);

export const TestConfigModule = ConfigModule.forRoot({
  envFilePath: ['.env.development'],
  isGlobal: true,
});

@Module({
  controllers: [ChatbotController],
  imports: [CacheModule.register()],
  providers: [ChatbotService, ChatbotApiService],
})
export class TestChatbotModule {}

export function setupIntegrationTest(
  module: Type<any>,
  modifyModules?: ModuleModifier | ModuleModifier[],
  additionalModules: Type<any>[] = [],
  additionalMiddlewares: ((
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => any)[] = [],
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

  // let redisTestServer: RedisMemoryServer;
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
      `Using Redis server: ${process.env.REDIS_HOST || 'localhost'}:${
        process.env.REDIS_PORT || 6379
      } (db ${getTestRedisDb()})`,
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
            db: getTestRedisDb(),
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
        BullModule.forRoot({
          connection: {
            host: redisHost,
            port: redisPort,
            db: getTestRedisDb(),
          },
          // BullMQ uses pub/sub internally; a per-worker prefix keeps events
          // from one worker from reaching another worker's queues.
          // On production/dev this prefix isn't necessary.
          prefix: getTestBullPrefix(),
        }),
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: BaseExceptionFilter,
        },
      ],
    });

    testModuleBuilder
      .overrideModule(ChatbotDataSourceModule)
      .useModule(TestChatbotDataSourceModule);

    if (modifyModules) {
      if (Array.isArray(modifyModules)) {
        for (const modifyModule of modifyModules) {
          testModuleBuilder = modifyModule(testModuleBuilder);
        }
      } else {
        testModuleBuilder = modifyModules(testModuleBuilder);
      }
    }
    testModule = await testModuleBuilder.compile();

    // Create and configure the application

    app = testModule.createNestApplication();
    addGlobalsToApp(app, true);
    if (additionalMiddlewares) {
      for (const mw of additionalMiddlewares) {
        app.use(mw);
      }
    }
    jwtService = testModule.get<JwtService>(JwtService);
    appConfig = testModule.get<ApplicationConfigService>(
      ApplicationConfigService,
    );
    dataSource = testModule.get<DataSource>(DataSource);
    redisService = testModule.get<RedisService>(RedisService);

    // The worker may have run another test file before this one. TypeORM has
    // already created/updated the schema, so clear any leftover rows before
    // application startup code reads the database.
    await resetDatabase(dataSource);

    await appConfig.loadConfig();
    await app.init();
    schedulerRegistry = testModule.get<SchedulerRegistry>(SchedulerRegistry);

    // Grab FactoriesService from Nest
    const factories = testModule.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);

    // Ensure Redis is connected before proceeding
    await ensureAllRedisConnected(redisService);
  }, 60000);

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

    // if (redisTestServer) {
    //   await redisTestServer.stop();
    // }
  }, 30000);

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await clearAllCronJobs(schedulerRegistry);

    // Each worker has its own Redis logical database, so flushdb only clears
    // this worker's keys (flushall would wipe every worker's data).
    const namespaces = ['db', 'pub', 'sub'];
    for (const namespace of namespaces) {
      try {
        const client = redisService.getClient(namespace);
        if (client && client.status === 'ready') {
          await client.flushdb();
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

export const mockChatbotService = {
  // can add more if you'd like
  addDocumentChunk: jest.fn(),
  deleteDocumentChunksByAsyncQuestionId: jest.fn(),
};
export const overrideChatbotService: ModuleModifier = (builder) =>
  builder.overrideProvider(ChatbotApiService).useValue(mockChatbotService);

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

/* Takes an array of emails (receivers) and type of email (types).
Also takes in subject and content (optional). If added, will check that they are correct and don't have null, undefined, etc.
*/
export const expectEmailSent = (
  receivers: (string | string[])[],
  types: string[],
  subject?: string,
  content?: string,
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
  // ensure the content and subject have no "null", "undefined", "[object Object]", "{}"
  const forbidden = ['null', 'undefined', 'object Object', '{}'];
  if (content) {
    calls.forEach((call) => {
      forbidden.forEach((term) => {
        if (call.content && typeof call.content === 'string') {
          expect(call.content).not.toContain(term);
        }
      });
    });
  }
  if (subject) {
    calls.forEach((call) => {
      forbidden.forEach((term) => {
        if (call.subject && typeof call.subject === 'string') {
          expect(call.subject).not.toContain(term);
        }
      });
    });
  }
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
    } catch (_err) {
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

export class MockResponse<
  TBody = any,
  TLocals = Record<string, any>,
> extends Response {
  _headers: Record<string, string> = {};
  statusCode: number;
  _redirect: string;
  _cookies: Record<string, string> = {};
  _body: TBody;
  locals: TLocals & Locals;
  headersSent: boolean = false;

  set(field: any, value?: string | string[]): this {
    if (typeof field === 'string') {
      this._headers[field] = Array.isArray(value) ? value.join(';') : value;
    } else {
      this._headers = {
        ...this._headers,
        ...field,
      };
    }
    return this;
  }

  header(field: any, value?: string | string[]): this {
    return this.set(field, value);
  }

  get(field: string): string | undefined {
    return this._headers[field];
  }

  cookie(name: string, val: string | any, options?: CookieOptions): this {
    this._cookies[`${name}${options ? '-' + JSON.stringify(options) : ''}`] =
      typeof val == 'string' ? val : JSON.stringify(val);
    this._headers['cookie'] = Object.entries(this._cookies)
      .map(([k, v]) => `${k.substring(0, k.indexOf('-'))}=${v}`)
      .join('; ');
    return this;
  }

  clearCookie(name: string, options?: CookieOptions): this {
    if (!options) {
      Object.keys(this._cookies).forEach((k) => {
        if (k.startsWith(name)) {
          delete this._cookies[k];
        }
      });
    } else {
      delete this._cookies[`${name}-${JSON.stringify(options)}`];
    }
    this._headers['cookie'] = Object.entries(this._cookies)
      .map(([k, v]) => `${k.substring(0, k.indexOf('-'))}=${v}`)
      .join('; ');
    return this;
  }

  location(url: string): this {
    this._headers['location'] = url;
    return this;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  sendStatus(code: number): this {
    this.statusCode = code;
    this.send();
    return this;
  }

  redirect(url: string): void;
  redirect(code: number | string, url?: string): void {
    if (typeof code === 'string') {
      this._redirect = code;
      this.statusCode = 302;
    } else {
      this._redirect = url;
      this.statusCode = code;
    }
  }

  send(body?: any): this {
    if (!this.statusCode) {
      this.statusCode = 200;
    }
    this._body = body;
    this.headersSent = true;
    return this;
  }
}

// TODO: add a function for not allowing someone to access a route because they are not in the course (said function will need to be passed what a successful call would look like and then just call it from another user who is in the same or but different course).

// TODO: Add some functions for calling routes with bad data to make sure said data isn't being accepted.
// Idk exactly how to go about it, but I know one thing that can be broken is typeorm if you pass it the name of entities that are null, which would cause errors.
// Could also try to call with a bunch of the correct properties but all booleans or all strings or something.
