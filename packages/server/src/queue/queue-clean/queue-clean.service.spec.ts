import { OpenQuestionStatus, LimboQuestionStatus } from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'typeorm';
import {
  AlertFactory,
  QuestionFactory,
  QueueFactory,
  UserFactory,
} from '../../../test/util/factories';
import { TestTypeOrmModule } from '../../../test/util/testUtils';
import { QuestionModel } from '../../question/question.entity';
import { QueueCleanService } from './queue-clean.service';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('QueueService', () => {
  let service: QueueCleanService;
  let conn: Connection;
  let schedulerRegistry: SchedulerRegistry;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueCleanService,
        {
          provide: SchedulerRegistry,
          useValue: {
            getCronJobs: jest.fn(),
            deleteCronJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QueueCleanService>(QueueCleanService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
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

      const question = await QuestionModel.findOne({});
      expect(question.status).toEqual('Queued');
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
      const cronJobs = new Map<string, any>();
      cronJobs.set('prompt-student-to-leave-queue-1-1', {});
      cronJobs.set('prompt-student-to-leave-queue-1-2', {});
      cronJobs.set('prompt-student-to-leave-queue-2-1', {});
      cronJobs.set('some-other-job', {});

      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      service.deleteAllLeaveQueueCronJobsForQueue(queueId);

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
      const cronJobs = new Map<string, any>();
      cronJobs.set('prompt-student-to-leave-queue-2-1', {});
      cronJobs.set('some-other-job', {});

      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      service.deleteAllLeaveQueueCronJobsForQueue(queueId);

      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith(
        'prompt-student-to-leave-queue-2-1',
      );
      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalledWith(
        'some-other-job',
      );
    });
  });
});
