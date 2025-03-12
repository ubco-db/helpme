jest.mock('typeorm', () => {
  const actualTypeorm = jest.requireActual('typeorm');

  return {
    ...actualTypeorm,
    createQueryBuilder: jest.fn(),
  };
});

import {
  OpenQuestionStatus,
  LimboQuestionStatus,
  AlertType,
  Role,
  ClosedQuestionStatus,
} from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createQueryBuilder, DataSource } from 'typeorm';
import {
  AlertFactory,
  initFactoriesFromService,
  QuestionFactory,
  QueueFactory,
  UserFactory,
} from '../../../test/util/factories';
import { TestTypeOrmModule } from '../../../test/util/testUtils';
import { QuestionModel } from '../../question/question.entity';
import { QueueCleanService } from './queue-clean.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QuestionService } from 'question/question.service';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { QueueService } from 'queue/queue.service';
import { AlertModel } from 'alerts/alerts.entity';
import { QueueModel } from 'queue/queue.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('QueueService', () => {
  let service: QueueCleanService;
  let dataSource: DataSource;
  let schedulerRegistry: SchedulerRegistry;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, FactoryModule],
      providers: [
        QueueCleanService,
        {
          provide: QuestionService,
          useValue: {
            changeStatus: jest.fn(),
          },
        },
        {
          provide: RedisQueueService,
          useValue: {
            setQuestions: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            getQuestions: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
            getCronJobs: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QueueCleanService>(QueueCleanService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
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
    jest.resetAllMocks();
  });

  describe('cleanQueue', () => {
    it('queue remains the same if any staff are checked in', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({ staffList: [ta] });
      await QuestionFactory.create({
        status: OpenQuestionStatus.Queued,
        queue: queue,
      });

      await service.cleanQueue(queue.id);

      const question = (await QuestionModel.find())?.pop();
      expect(question?.status).toEqual('Queued');
    });
    it('if no staff are present all questions with open status are marked as stale', async () => {
      const queue = await QueueFactory.create({});
      const question = await QuestionFactory.create({
        status: OpenQuestionStatus.Queued,
        queue: queue,
      });

      await service.cleanQueue(queue.id);
      await question.reload();
      // expect(question.status).toEqual('Stale');
      // TODO:  verify that this is the correct behavior
      expect(question.status).toEqual('Queued');
    });
    it('queue gets cleaned when force parameter is passed, even with staff present', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({ staffList: [ta] });
      const question = await QuestionFactory.create({
        status: OpenQuestionStatus.Queued,
        queue: queue,
      });

      await service.cleanQueue(queue.id, true);

      await question.reload();
      expect(question.status).toEqual('Stale');
    });

    it('if no staff are present all questions with limbo status are marked as stale', async () => {
      const queue = await QueueFactory.create({});
      const question = await QuestionFactory.create({
        status: LimboQuestionStatus.TADeleted,
        queue: queue,
      });

      await service.cleanQueue(queue.id);
      await question.reload();
      // expect(question.status).toEqual('Stale');
      // TODO: verify that this is the correct behavior
      expect(question.status).toEqual('TADeleted');
    });
    it('resolves lingering alerts from a queue', async () => {
      const queue = await QueueFactory.create({});
      const openQuestion = await QuestionFactory.create({
        queue,
      });
      const openAlert = await AlertFactory.create({
        user: openQuestion.creator,
        course: queue.course,
        payload: {
          questionId: openQuestion.id,
          queueId: queue.id,
          courseId: queue.course.id,
        },
      });
      expect(openAlert.resolved).toBeNull();

      await service.cleanQueue(queue.id);

      await openAlert.reload();
      // expect(openAlert.resolved).not.toBeNull();
      // TODO: verify that this is the correct behavior
      expect(openAlert.resolved).toBeNull();
    });
  });
  describe('cleanAllQueues', () => {
    it('correctly cleans queues that have questions in open or limbo state', async () => {
      const cleanQueueSpy = jest.spyOn(service, 'cleanQueue');

      const queue1 = await QueueFactory.create({
        notes: 'clean me',
      });
      const queue2 = await QueueFactory.create({
        notes: 'I could also use a clean',
      });
      await QuestionFactory.create({
        queue: queue1,
        status: OpenQuestionStatus.Queued,
      });
      await QuestionFactory.create({
        queue: queue2,
        status: LimboQuestionStatus.CantFind,
      });

      await service.cleanAllQueues();

      await queue1.reload();
      await queue2.reload();
      expect(cleanQueueSpy).toHaveBeenCalledTimes(2);
    });
    it('does not clean queue that has no questions in open or limbo state', async () => {
      const cleanQueueSpy = jest.spyOn(service, 'cleanQueue');

      await QueueFactory.create({ notes: 'clean me' });

      await service.cleanAllQueues();
      expect(cleanQueueSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('deleteAllLeaveQueueCronJobsForQueue', () => {
    it('should delete all cron jobs for the specified queue', () => {
      const queueId = 1;
      const mockJob = { stop: jest.fn() };
      const cronJobs = new Map<string, any>();
      cronJobs.set('prompt-student-to-leave-queue-1-1', mockJob);
      cronJobs.set('prompt-student-to-leave-queue-1-2', mockJob);
      cronJobs.set('prompt-student-to-leave-queue-2-1', mockJob);
      cronJobs.set('some-other-job', mockJob);

      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      service.deleteAllLeaveQueueCronJobsForQueue(queueId);

      expect(mockJob.stop).toHaveBeenCalledTimes(2);
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledTimes(2);
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        'prompt-student-to-leave-queue-1-1',
      );
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        'prompt-student-to-leave-queue-1-2',
      );
    });

    it('should not delete cron jobs for other queues', () => {
      const queueId = 1;
      const mockJob = { stop: jest.fn() };
      const cronJobs = new Map<string, any>();
      cronJobs.set('prompt-student-to-leave-queue-2-1', mockJob);
      cronJobs.set('some-other-job', mockJob);

      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      service.deleteAllLeaveQueueCronJobsForQueue(queueId);

      expect(mockJob.stop).not.toHaveBeenCalled();
      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith(
        'prompt-student-to-leave-queue-2-1',
      );
      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith(
        'some-other-job',
      );
    });
  });

  describe('promptStudentsToLeaveQueue', () => {
    it('should create alerts and schedule cron jobs for students in the queue', async () => {
      const queueId = 1;
      const studentId = 1;
      const courseId = 1;

      // mock deleteAllLeaveQueueCronJobsForQueue
      jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ studentId, courseId }]),
        getOne: jest.fn().mockResolvedValue(null),
      } as any;
      (createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder);

      jest.spyOn(QueueModel, 'query').mockResolvedValue([]);
      jest
        .spyOn(createQueryBuilder(QueueModel), 'getRawMany')
        .mockResolvedValue([{ studentId, courseId }]);
      jest.spyOn(AlertModel, 'create').mockImplementation((alert) => ({
        ...alert,
        save: jest.fn().mockResolvedValue(alert),
        hasId: jest.fn().mockReturnValue(true),
        remove: jest.fn(),
        softRemove: jest.fn(),
        recover: jest.fn(),
        reload: jest.fn(),
      }));

      await service.promptStudentsToLeaveQueue(queueId);

      expect(AlertModel.create).toHaveBeenCalledTimes(1);
      expect(AlertModel.create).toHaveBeenCalledWith({
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        sent: expect.any(Date),
        userId: studentId,
        courseId: courseId,
        payload: { queueId },
      });
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('should not create alerts or schedule cron jobs if staff are checked in', async () => {
      const queueId = 1;
      const staffList = [{ userId: 1 }];
      jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();

      jest.spyOn(QueueModel, 'query').mockResolvedValue(staffList);

      await service.promptStudentsToLeaveQueue(queueId);

      expect(AlertModel.create).not.toHaveBeenCalled();
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });

    it('should not create duplicate alerts for the same student', async () => {
      const queueId = 1;
      const studentId = 1;
      const courseId = 1;
      const existingAlert = {
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        resolved: null,
        userId: studentId,
        courseId: courseId,
      } as any;
      jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ studentId, courseId }]),
        getOne: jest.fn().mockResolvedValue(existingAlert),
      } as any;
      (QueueModel.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      jest.spyOn(QueueModel, 'query').mockResolvedValue([]);
      jest
        .spyOn(QueueModel.createQueryBuilder(), 'getRawMany')
        .mockResolvedValue([{ studentId, courseId }]);

      await service.promptStudentsToLeaveQueue(queueId);

      expect(AlertModel.create).not.toHaveBeenCalled();
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });
  describe('autoLeaveQueue', () => {
    let consoleErrorSpy: jest.SpyInstance;
    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });
    it('should resolve the alert and mark questions as LeftDueToNoStaff if the alert is not resolved', async () => {
      const userId = 1;
      const queueId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;

      const mockQuestions = [
        {
          id: 1,
          status: OpenQuestionStatus.Queued,
          save: jest.fn().mockResolvedValue(true),
        },
      ] as unknown as QuestionModel[];

      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);
      jest.spyOn(QuestionModel, 'inQueueWithStatus').mockReturnValue({
        getMany: jest.fn().mockResolvedValue(mockQuestions),
      } as any);
      jest
        .spyOn(service.queueService, 'getQuestions')
        .mockResolvedValue([] as any);
      jest.spyOn(service.redisQueueService, 'setQuestions').mockResolvedValue();

      await service.autoLeaveQueue(userId, queueId, courseId, alertId);

      expect(mockAlert.save).toHaveBeenCalled();
      expect(service.questionService.changeStatus).toHaveBeenCalledWith(
        ClosedQuestionStatus.LeftDueToNoStaff,
        mockQuestions[0],
        userId,
        Role.STUDENT,
      );
      expect(service.queueService.getQuestions).toHaveBeenCalledWith(queueId);
      expect(service.redisQueueService.setQuestions).toHaveBeenCalledWith(
        `q:${queueId}`,
        [],
      );
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        `prompt-student-to-leave-queue-${queueId}-${userId}`,
      );
    });

    it('should schedule a new cron job if the alert is resolved', async () => {
      const userId = 1;
      const queueId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockAlert = {
        id: alertId,
        resolved: new Date(),
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;

      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);
      jest.spyOn(schedulerRegistry, 'deleteCronJob').mockImplementation();
      jest.spyOn(schedulerRegistry, 'addCronJob').mockImplementation();

      await service.autoLeaveQueue(userId, queueId, courseId, alertId);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        `prompt-student-to-leave-queue-${queueId}-${userId}`,
      );
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('should log an error and capture exception if getting alert fails', async () => {
      const userId = 1;
      const queueId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockError = new Error('Alert not found');
      jest.spyOn(AlertModel, 'findOneOrFail').mockRejectedValue(mockError);

      await service.autoLeaveQueue(userId, queueId, courseId, alertId);

      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting auto-leave-queue alert in cron job',
        mockError,
      );
    });

    it('should log an error and capture exception if resolving alert fails', async () => {
      const userId = 1;
      const queueId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockRejectedValue(new Error('Save failed')),
      } as unknown as AlertModel;

      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      await service.autoLeaveQueue(userId, queueId, courseId, alertId);

      expect(mockAlert.save).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resolving auto-leave-queue alert in cron job',
        expect.any(Error),
      );
    });

    it('should log an error and capture exception if marking questions as LeftDueToNoStaff fails', async () => {
      const userId = 1;
      const queueId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;

      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);
      jest.spyOn(QuestionModel, 'inQueueWithStatus').mockReturnValue({
        getMany: jest.fn().mockRejectedValue(new Error('GetMany failed')),
      } as any);

      await service.autoLeaveQueue(userId, queueId, courseId, alertId);

      expect(QuestionModel.inQueueWithStatus).toHaveBeenCalledWith(queueId, [
        ...Object.values(OpenQuestionStatus),
        ...Object.values(LimboQuestionStatus),
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error marking question as LeftDueToNoStaff in cron job',
        expect.any(Error),
      );
    });
  });
});
