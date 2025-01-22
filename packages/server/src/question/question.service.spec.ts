import {
  ClosedQuestionStatus,
  OpenQuestionStatus,
  QuestionStatusKeys,
  Role,
} from '@koh/common';
import { TestingModule, Test } from '@nestjs/testing';
import { NotificationService } from 'notification/notification.service';
import { Connection } from 'typeorm';
import {
  QueueFactory,
  QuestionGroupFactory,
  QuestionFactory,
  UserFactory,
  TACourseFactory,
  UserCourseFactory,
  CourseFactory,
} from '../../test/util/factories';
import { TestTypeOrmModule, TestConfigModule } from '../../test/util/testUtils';
import { QuestionGroupModel } from './question-group.entity';
import { QuestionModel } from './question.entity';
import { QuestionService } from './question.service';
import { QueueModel } from 'queue/queue.entity';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { QueueService } from 'queue/queue.service';
import { AlertsService } from 'alerts/alerts.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { RedisService } from 'nestjs-redis';

describe('QuestionService', () => {
  let service: QuestionService;

  let conn: Connection;

  const mockRedisService = {
    getClient: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      lrange: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
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
        NotificationService,
        AlertsService,
        ApplicationConfigService,
        QueueChatService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
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

      const resolvedQuestion1 = await QuestionModel.findOne(question1.id);
      const resolvedQuestion2 = await QuestionModel.findOne(question2.id);

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

      const updatedQuestion = await QuestionModel.findOne(taskQuestion.id);
      expect(updatedQuestion.status).toBe(ClosedQuestionStatus.Resolved);
      const realQueue = await QueueModel.findOne(queue.id);

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
