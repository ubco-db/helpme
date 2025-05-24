import {
  ClosedQuestionStatus,
  OpenQuestionStatus,
  QuestionStatusKeys,
  Role,
} from '@koh/common';
import { TestingModule, Test } from '@nestjs/testing';
import { NotificationService } from 'notification/notification.service';
import { DataSource } from 'typeorm';
import {
  QueueFactory,
  QuestionGroupFactory,
  QuestionFactory,
  UserFactory,
  TACourseFactory,
  UserCourseFactory,
  CourseFactory,
  initFactoriesFromService,
} from '../../test/util/factories';
import { TestTypeOrmModule, TestConfigModule } from '../../test/util/testUtils';
import { QuestionGroupModel } from './question-group.entity';
import { QuestionModel } from './question.entity';
import { QuestionService } from './question.service';
import { QueueModel } from 'queue/queue.entity';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { QueueService } from 'queue/queue.service';
import { AlertsService } from 'alerts/alerts.service';
import { ApplicationConfigService } from '../config/application_config.service';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { QueueSSEService } from 'queue/queue-sse.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('QuestionService', () => {
  let service: QuestionService;
  let dataSource: DataSource;
  // TODO: fix this test so that it uses RedisMemoryServer instead of our redis container.
  // let redisMock: RedisMemoryServer;
  let module: TestingModule;

  beforeAll(async () => {
    // redisMock = new RedisMemoryServer();
    // const redisHost = await redisMock.getHost();
    // const redisPort = await redisMock.getPort();

    module = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        RedisModule.forRoot({
          readyLog: false,
          errorLog: true,
          commonOptions: {
            host: process.env.REDIS_HOST || 'localhost',
            port: 6379,
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
          provide: QueueService,
          useValue: {
            getQuestions: jest.fn(),
          },
        },
        QuestionService,
        {
          provide: RedisQueueService,
          useValue: {
            setQuestions: jest.fn(),
          },
        },
        {
          provide: QueueSSEService,
          useValue: {
            updateQueueChats: jest.fn(),
            updateQuestions: jest.fn(),
            updateQueue: jest.fn(),
            sendToRoom: jest.fn(),
            subscribeClient: jest.fn(),
          },
        },
        {
          provide: QueueChatService,
          useValue: {
            getMyChats: jest.fn(),
            endChats: jest.fn(),
            clearChats: jest.fn(),
            checkChatExists: jest.fn(),
            createChat: jest.fn(),
          },
        },
        NotificationService,
        AlertsService,
        ApplicationConfigService,
        QueueChatService,
        {
          provide: 'REDIS_CLIENT',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    try {
      // Gracefully close module first to close Redis connections
      if (module) {
        await module.close();
      }

      // Then safely destroy dataSource if it's initialized
      if (dataSource && dataSource.isInitialized) {
        await dataSource.destroy();
      }
    } catch (err) {
      console.error('Error cleaning up:', err);
    } finally {
      // Always stop Redis in finally block
      // if (redisMock) {
      //   await redisMock.stop();
      // }
    }
  });

  beforeEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.synchronize(true);
    }
  });

  describe('changeStatus', () => {
    it('removes question from a group if put into Limbo status', async () => {
      const queue = await QueueFactory.create();
      const ta = await UserFactory.create();
      const usercourse = await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });
      const group = await QuestionGroupFactory.create({
        queue,
        creator: usercourse,
      });
      const g1q1 = await QuestionFactory.create({
        queue,
        groupable: true,
        group,
        taHelped: ta,
        status: QuestionStatusKeys.Helping,
      });
      const g1q2 = await QuestionFactory.create({
        queue,
        groupable: true,
        group,
        taHelped: ta,
        status: QuestionStatusKeys.Helping,
      });

      await service.changeStatus(
        QuestionStatusKeys.CantFind,
        g1q2,
        ta.id,
        Role.TA,
      );

      const updatedGroup = await QuestionGroupModel.findOne({
        where: { id: group.id },
        relations: ['questions'],
      });
      const updatedQ2 = await QuestionModel.findOne({
        where: { id: g1q2.id },
        relations: ['group'],
      });
      expect(updatedGroup.questions.length).toEqual(1);
      expect(updatedGroup.questions[0].id).toEqual(g1q1.id);
      expect(updatedQ2.group).toBeNull();
      expect(updatedQ2.groupId).toBeNull();
      expect(updatedQ2.status).toEqual(QuestionStatusKeys.CantFind);
    });
  });
  describe('resolveQuestions', () => {
    it('should resolve all helping questions for a given helper', async () => {
      const queue = await QueueFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      const question1 = await QuestionFactory.create({
        queue,
        taHelped: ta,
        status: OpenQuestionStatus.Helping,
      });

      const question2 = await QuestionFactory.create({
        queue,
        taHelped: ta,
        status: OpenQuestionStatus.Helping,
      });
      jest
        .spyOn(service.queueService, 'getQuestions')
        .mockResolvedValue([question1, question2] as any);

      await service.resolveQuestions(queue.id, ta.id);

      const resolvedQuestion1 = await QuestionModel.findOne({
        where: {
          id: question1.id,
        },
      });
      const resolvedQuestion2 = await QuestionModel.findOne({
        where: {
          id: question2.id,
        },
      });

      expect(resolvedQuestion1.status).toEqual(ClosedQuestionStatus.Resolved);
      expect(resolvedQuestion2.status).toEqual(ClosedQuestionStatus.Resolved);

      expect(service.queueService.getQuestions).toHaveBeenCalledWith(queue.id);
      expect(service.redisQueueService.setQuestions).toHaveBeenCalledWith(
        `q:${queue.id}`,
        [question1, question2], // note that these should be the updated questions, but I would need to somehow mock getQuestions to return the updated questions before they were updated and I'm good thanks
      );
    });

    it('should mark tasks done for task questions', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      await UserCourseFactory.create({ user: student, course });
      const queue = await QueueFactory.create({
        course,
        config: {
          assignment_id: 'lab1',
          tasks: {
            task1: {
              color_hex: '#000000',
              display_name: 'Task 1',
              short_display_name: 'T1',
              precondition: null,
              blocking: false,
            },
            task2: {
              color_hex: '#000000',
              display_name: 'Task 2',
              short_display_name: 'T2',
              precondition: 'task1',
              blocking: false,
            },
          },
        },
      });
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course,
        user: ta,
      });

      const taskQuestion = await QuestionFactory.create({
        text: 'Mark "task1" "task2"',
        queue,
        taHelped: ta,
        status: OpenQuestionStatus.Helping,
        isTaskQuestion: true,
      });

      jest.spyOn(service, 'checkIfValidTaskQuestion').mockResolvedValue();
      jest.spyOn(service, 'markTasksDone').mockResolvedValue();

      jest
        .spyOn(service.queueService, 'getQuestions')
        .mockResolvedValue([taskQuestion] as any);
      await service.resolveQuestions(queue.id, ta.id);

      const updatedQuestion = await QuestionModel.findOne({
        where: {
          id: taskQuestion.id,
        },
      });
      expect(updatedQuestion.status).toBe(ClosedQuestionStatus.Resolved);
      const realQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });

      expect(service.checkIfValidTaskQuestion).toHaveBeenCalledWith(
        updatedQuestion,
        realQueue,
      );
      expect(service.markTasksDone).toHaveBeenCalledWith(
        updatedQuestion,
        taskQuestion.creatorId,
      );

      expect(service.queueService.getQuestions).toHaveBeenCalledWith(queue.id);
      expect(service.redisQueueService.setQuestions).toHaveBeenCalledWith(
        `q:${queue.id}`,
        [taskQuestion], // note that these should be the updated questions, but I would need to somehow mock getQuestions to return the updated questions before they were updated and I'm good thanks
      );
    });

    it('should handle no questions gracefully', async () => {
      const queue = await QueueFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      await expect(
        service.resolveQuestions(queue.id, ta.id),
      ).resolves.not.toThrow();
    });
  });
});
