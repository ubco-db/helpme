import {
  OpenQuestionStatus,
  LimboQuestionStatus,
  AlertType,
  Role,
  ClosedQuestionStatus,
} from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  AlertFactory,
  initFactoriesFromService,
  QuestionFactory,
  QueueFactory,
  UserFactory,
  QueueStaffFactory,
} from '../../../test/util/factories';
import {
  TestTypeOrmModule,
  TestConfigModule,
} from '../../../test/util/testUtils';
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
import { NotificationService } from 'notification/notification.service';
import { AlertsService } from 'alerts/alerts.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { QueueSSEService } from 'queue/queue-sse.service';

describe('QueueCleanService', () => {
  let service: QueueCleanService;
  let dataSource: DataSource;
  let schedulerRegistry: SchedulerRegistry;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
      providers: [
        QueueCleanService,
        QuestionService,
        NotificationService,
        AlertsService,
        ApplicationConfigService,
        {
          provide: QueueService,
          useValue: {
            getQuestions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RedisQueueService,
          useValue: {
            setQuestions: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
            getCronJobs: jest.fn().mockReturnValue(new Map()),
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
        {
          provide: 'REDIS_CLIENT',
          useValue: {},
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
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.synchronize(true);
    }
    jest.clearAllMocks();
  });

  describe('cleanQueue', () => {
    it('queue remains the same if any staff are checked in', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({});
      await QueueStaffFactory.create({ queue, user: ta });

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
      expect(question.status).toEqual('Stale');
    });

    it('queue gets cleaned when force parameter is passed, even with staff present', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({});
      await QueueStaffFactory.create({ queue, user: ta });

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
      expect(question.status).toEqual('Stale');
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
      expect(openAlert.resolved).not.toBeNull();
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
      const queue = await QueueFactory.create({});
      const student = await UserFactory.create();
      const question = await QuestionFactory.create({
        queue,
        creator: student,
        status: OpenQuestionStatus.Queued,
      });

      // Mock deleteAllLeaveQueueCronJobsForQueue to keep test focused
      const deleteCronSpy = jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();

      await service.promptStudentsToLeaveQueue(queue.id, dataSource.manager);

      const alert = await AlertModel.findOne({
        where: {
          userId: student.id,
          courseId: queue.course.id,
          alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        },
      });

      expect(alert).toBeDefined();
      expect(alert?.payload).toEqual(
        expect.objectContaining({
          queueId: queue.id,
          queueQuestionId: question.id,
        }),
      );
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();

      const jobName = `prompt-student-to-leave-queue-${queue.id}-${student.id}`;
      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        jobName,
        expect.any(Object),
      );
    });

    it('should not create alerts or schedule cron jobs if staff are checked in', async () => {
      const queue = await QueueFactory.create({});
      const ta = await UserFactory.create();
      await QueueStaffFactory.create({ queue, user: ta });

      const student = await UserFactory.create();
      await QuestionFactory.create({
        queue,
        creator: student,
        status: OpenQuestionStatus.Queued,
      });

      jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();

      await service.promptStudentsToLeaveQueue(queue.id, dataSource.manager);

      const alert = await AlertModel.findOne({
        where: {
          userId: student.id,
          courseId: queue.course.id,
          alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        },
      });

      expect(alert).toBeNull();
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });

    it('should not create duplicate alerts for the same student', async () => {
      const queue = await QueueFactory.create({});
      const student = await UserFactory.create();
      await QuestionFactory.create({
        queue,
        creator: student,
        status: OpenQuestionStatus.Queued,
      });

      // Create existing alert
      await AlertFactory.create({
        user: student,
        course: queue.course,
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        payload: { queueId: queue.id },
      });

      jest
        .spyOn(service, 'deleteAllLeaveQueueCronJobsForQueue')
        .mockImplementation();
      jest.clearAllMocks(); // clear addCronJob calls from previous Create

      await service.promptStudentsToLeaveQueue(queue.id, dataSource.manager);

      // Check that only 1 alert exists
      const alerts = await AlertModel.find({
        where: {
          userId: student.id,
          courseId: queue.course.id,
          alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        },
      });

      expect(alerts.length).toBe(1);
      // addCronJob might have been called if logic was entered, but logic returns early if existingAlert
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
      const queue = await QueueFactory.create({});
      const student = await UserFactory.create();
      const question = await QuestionFactory.create({
        queue,
        creator: student,
        status: OpenQuestionStatus.Queued,
      });
      const alert = await AlertFactory.create({
        user: student,
        course: queue.course,
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        payload: { queueId: queue.id },
      });
      // ensure alert is unresolved
      await AlertModel.update(alert.id, { resolved: null });

      await service.autoLeaveQueue(
        student.id,
        queue.id,
        queue.course.id,
        alert.id,
      );

      await alert.reload();
      await question.reload();

      expect(alert.resolved).not.toBeNull();
      expect(question.status).toEqual(ClosedQuestionStatus.LeftDueToNoStaff);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        `prompt-student-to-leave-queue-${queue.id}-${student.id}`,
      );
    });

    it('should schedule a new cron job if the alert is resolved', async () => {
      const queue = await QueueFactory.create({});
      const student = await UserFactory.create();
      const alert = await AlertFactory.create({
        user: student,
        course: queue.course,
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
        payload: { queueId: queue.id },
      });
      // ensure alert IS resolved (User clicked 'Stay')
      await AlertModel.update(alert.id, { resolved: new Date() });

      await service.autoLeaveQueue(
        student.id,
        queue.id,
        queue.course.id,
        alert.id,
      );

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        `prompt-student-to-leave-queue-${queue.id}-${student.id}`,
      );
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });

    it('should log an error if getting alert fails', async () => {
      const alertId = 99999;
      await service.autoLeaveQueue(1, 1, 1, alertId);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting auto-leave-queue alert in cron job',
        expect.any(Error),
      );
    });
  });
});
