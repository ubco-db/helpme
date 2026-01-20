import { ListQuestionsResponse, QuestionStatusKeys, Role } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mapValues, zip } from 'lodash';
import { QuestionModel } from 'question/question.entity';
import { DataSource } from 'typeorm';
import {
  initFactoriesFromService,
  QuestionFactory,
  QueueFactory,
  UserFactory,
} from '../../test/util/factories';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { QueueModel } from './queue.entity';
import { QueueService } from './queue.service';
import { AlertsService } from '../alerts/alerts.service';
import { ApplicationTestingConfigModule } from 'config/application_config.module';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { QueueStaffService } from './queue-staff/queue-staff.service';

describe('QueueService', () => {
  let service: QueueService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        ApplicationTestingConfigModule,
      ],
      providers: [
        QueueService,
        {
          provide: QueueStaffService,
          useValue: {
            formatStaffListPropertyForFrontend: jest.fn(),
            getFormattedStaffList: jest.fn(),
          },
        },
        AlertsService,
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  // create 1 question for each status that exists, and put them all in a queue
  async function createQuestionsEveryStatus(
    queue: QueueModel,
  ): Promise<QuestionModel[]> {
    const allStatuses = Object.values(QuestionStatusKeys);
    const questions = await QuestionFactory.createList(allStatuses.length, {
      queue,
    });
    for (const [status, question] of zip(allStatuses, questions)) {
      question.status = status;
    }
    await QuestionModel.save(questions);
    return questions;
  }

  describe('getQuestions', () => {
    it('only returns questions in the given queue', async () => {
      const queue = await QueueFactory.create();
      await QuestionFactory.create();
      await QuestionFactory.create({ queue });
      expect((await service.getQuestions(queue.id)).questions.length).toEqual(
        1,
      );
    });

    it('filters questions by status appropriately', async () => {
      const queue = await QueueFactory.create();
      await createQuestionsEveryStatus(queue);

      const questionResponse = await service.getQuestions(queue.id);
      const statuses = mapValues(
        questionResponse,
        (questions: QuestionModel[]) => questions.map((q) => q.status),
      );
      expect(statuses).toEqual({
        priorityQueue: ['PriorityQueued'],
        questionsGettingHelp: ['Helping', 'Paused'],
        questions: ['Queued', 'Drafting', 'ReQueueing'],
        groups: [],
        unresolvedAlerts: [],
      });
    });

    it('sorts queue questions by createdat', async () => {
      const queue = await QueueFactory.create();
      const questionIds = [];
      for (let i = 0; i < 3; i++) {
        const question = await QuestionFactory.create({
          queue,
          createdAt: new Date(Date.now() + i * 1000),
        });
        questionIds.push(question.id);
      }

      expect(
        (await service.getQuestions(queue.id)).questions.map((q) => q.id),
      ).toEqual(questionIds);
    });

    it('sorts priority queue questions by createdat', async () => {
      const queue = await QueueFactory.create();
      const questionIds = [];
      for (let i = 0; i < 3; i++) {
        const question = await QuestionFactory.create({
          queue,
          status: 'PriorityQueued',
          createdAt: new Date(Date.now() + i * 1000),
        });
        questionIds.push(question.id);
      }

      expect(
        (await service.getQuestions(queue.id)).priorityQueue.map((q) => q.id),
      ).toEqual(questionIds);
    });
  });

  describe('personalizeQuestions', () => {
    let queue;
    beforeEach(async () => {
      queue = await QueueFactory.create();
    });

    const personalize = (
      lqr: ListQuestionsResponse,
      userId: number,
      role: Role,
    ) => service.personalizeQuestions(queue.id, lqr, userId, role);

    it('does nothing if not a student', async () => {
      const user = await UserFactory.create();
      await QuestionFactory.create({
        queue,
        createdAt: new Date('2020-11-02T12:00:00.000Z'),
      });
      const lqr = await service.getQuestions(queue.id);
      expect(
        await service.personalizeQuestions(queue.id, lqr, user.id, Role.TA),
      ).toEqual(lqr);
    });

    it('adds yourQuestions for students with a question in the queue', async () => {
      const user = await UserFactory.create();
      // Create a question but not in this queue
      await QuestionFactory.create({ creator: user });

      const blank: ListQuestionsResponse = {
        questions: [],
        priorityQueue: [],
        questionsGettingHelp: [],
        groups: [],
      };
      let lqr = await personalize(blank, user.id, Role.STUDENT);
      expect(lqr.yourQuestions).toEqual([]);

      // Create a question in this queue
      const question = await QuestionFactory.create({
        creator: user,
        queue,
      });
      lqr = await personalize(blank, user.id, Role.STUDENT);
      expect(lqr.yourQuestions[0].id).toEqual(question.id);
    });

    it('hides details of other students', async () => {
      const ours = await QuestionFactory.create({
        queue,
        createdAt: new Date('2020-11-02T12:00:00.000Z'),
        text: 'help us',
      });
      await QuestionFactory.create({
        queue,
        createdAt: new Date('2020-11-02T12:00:00.000Z'),
        text: 'help someone else',
      });

      const lqr = await personalize(
        await service.getQuestions(queue.id),
        ours.creatorId,
        Role.STUDENT,
      );
      expect(lqr).toMatchSnapshot({
        questions: [
          {
            questionTypes: [
              {
                createdAt: expect.any(Date),
              },
            ],
          },
          {
            questionTypes: [
              {
                createdAt: expect.any(Date),
              },
            ],
          },
        ],
        yourQuestions: [
          {
            questionTypes: [
              {
                createdAt: expect.any(Date),
              },
            ],
          },
        ],
      } as any);
    });
  });
});
