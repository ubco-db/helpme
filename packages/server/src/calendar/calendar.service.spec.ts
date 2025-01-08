/* eslint-disable @typescript-eslint/no-empty-function */
import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BadRequestException } from '@nestjs/common';
import { CronJob } from 'cron';
import { QuestionService } from '../question/question.service';
import { NotificationService } from '../notification/notification.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { QueueModel } from '../queue/queue.entity';
import { AlertModel } from '../alerts/alerts.entity';
import { AlertType } from '@koh/common';
import { QueueCleanService } from 'queue/queue-clean/queue-clean.service';
import { EventModel } from 'profile/event-model.entity';

describe('CalendarService', () => {
  let service: CalendarService;
  let schedulerRegistry: SchedulerRegistry;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [
        CalendarService,
        {
          provide: QuestionService,
          useValue: {
            resolveQuestions: jest.fn(),
          },
        },
        NotificationService,
        {
          provide: QueueCleanService,
          useValue: {
            promptStudentsToLeaveQueue: jest.fn(),
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

    service = module.get<CalendarService>(CalendarService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createAutoCheckoutCronJob', () => {
    it('should create a one-time cron job for non-recurring events', async () => {
      const userId = 1;
      const calendarId = 1;
      const startDate = null;
      const endDate = null;
      // endTime = tomorrow
      const endTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
      const daysOfWeek: string[] = [];

      await service.createAutoCheckoutCronJob(
        userId,
        calendarId,
        startDate,
        endDate,
        endTime,
        daysOfWeek,
        1,
      );

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.nextDate().toJSDate()).toEqual(endTime);
      expect(job.runOnce).toBeTruthy();
    });
    it('should not allow you to create a cron job for a date in the past (only for non-recurring events)', async () => {
      const userId = 1;
      const calendarId = 1;
      const startDate = null;
      const endDate = null;
      // endTime = yesterday
      const endTime = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
      const daysOfWeek: string[] = [];

      await expect(
        service.createAutoCheckoutCronJob(
          userId,
          calendarId,
          startDate,
          endDate,
          endTime,
          daysOfWeek,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
    it('should create a recurring cron job for recurring events', async () => {
      const userId = 1;
      const calendarId = 1;
      const startDate = new Date();
      const endDate = new Date();
      const endTime = new Date();
      const daysOfWeek = ['1', '2', '3'];

      await service.createAutoCheckoutCronJob(
        userId,
        calendarId,
        startDate,
        endDate,
        endTime,
        daysOfWeek,
        1,
      );

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      const expectedCronTime = `${endTime.getMinutes()} ${endTime.getHours()} * * ${daysOfWeek.join(',')}`;
      expect(job.cronTime.source).toEqual(expectedCronTime);
      expect(job.runOnce).toBeFalsy();
    });
    it('should throw a BadRequestException for invalid event', async () => {
      const userId = 1;
      const calendarId = 1;
      const startDate = null;
      const endDate = new Date();
      const endTime = new Date();
      const daysOfWeek: string[] = [];

      await expect(
        service.createAutoCheckoutCronJob(
          userId,
          calendarId,
          startDate,
          endDate,
          endTime,
          daysOfWeek,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initializeAutoCheckout', () => {
    let sendAlertToAutoCheckout10minsFromNowSpy: jest.SpyInstance;

    beforeEach(() => {
      sendAlertToAutoCheckout10minsFromNowSpy = jest
        .spyOn(service, 'sendAlertToAutoCheckout10minsFromNow')
        .mockImplementation();
    });

    afterEach(() => {
      sendAlertToAutoCheckout10minsFromNowSpy.mockRestore();
    });

    it('should check if the user is checked in and send an alert if they are', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      const mockCheckedInQueues = [{ queueModelId: 1, userModelId: userId }];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      await service.initializeAutoCheckout(userId, calendarId, courseId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(sendAlertToAutoCheckout10minsFromNowSpy).toHaveBeenCalledWith(
        userId,
        calendarId,
        courseId,
        true,
      );
    });

    it('should not send an alert if the user is not checked in', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      const mockCheckedInQueues: any[] = [];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      await service.initializeAutoCheckout(userId, calendarId, courseId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(sendAlertToAutoCheckout10minsFromNowSpy).not.toHaveBeenCalled();
    });

    it('should log an error and capture exception if the query fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      const mockError = new Error('Query failed');
      jest.spyOn(QueueModel, 'query').mockRejectedValue(mockError);

      await service.initializeAutoCheckout(userId, calendarId, courseId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking if user is checked in',
        mockError,
      );
      expect(sendAlertToAutoCheckout10minsFromNowSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendAlertToAutoCheckout10minsFromNow', () => {
    it('should create an alert and schedule a cron job', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      const mockAlert = new AlertModel();
      mockAlert.id = 1;
      mockAlert.alertType = AlertType.EVENT_ENDED_CHECKOUT_STAFF;
      mockAlert.sent = new Date();
      mockAlert.userId = userId;
      mockAlert.courseId = courseId;
      mockAlert.payload = {};

      const alertSaveSpy = jest
        .spyOn(AlertModel.prototype, 'save')
        .mockResolvedValue(mockAlert);
      jest.spyOn(AlertModel, 'create').mockReturnValue(mockAlert);

      await service.sendAlertToAutoCheckout10minsFromNow(
        userId,
        calendarId,
        courseId,
      );

      expect(alertSaveSpy).toHaveBeenCalled();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job: CronJob = (schedulerRegistry.addCronJob as jest.Mock).mock
        .calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.running).toBe(true);
      // 10 minutes from now (+/- 2mins for test execution time)
      expect(job.nextDate().toJSDate().getTime()).toBeCloseTo(
        new Date().getTime() + 10 * 60 * 1000,
        -2,
      );
    });

    it('should delete existing cron job if not first time', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const jobName = `auto-checkout-loop-${userId}-${calendarId}`;

      const mockAlert = new AlertModel();
      mockAlert.id = 1;
      mockAlert.alertType = AlertType.EVENT_ENDED_CHECKOUT_STAFF;
      mockAlert.sent = new Date();
      mockAlert.userId = userId;
      mockAlert.courseId = courseId;
      mockAlert.payload = {};

      const alertSaveSpy = jest
        .spyOn(AlertModel.prototype, 'save')
        .mockResolvedValue(mockAlert);
      jest.spyOn(AlertModel, 'create').mockReturnValue(mockAlert);

      await service.sendAlertToAutoCheckout10minsFromNow(
        userId,
        calendarId,
        courseId,
        false,
      );

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(jobName);
      expect(alertSaveSpy).toHaveBeenCalled();
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.running).toBe(true);
      // 10 minutes from now (+/- 2mins for test execution time)
      expect(job.nextDate().toJSDate().getTime()).toBeCloseTo(
        new Date().getTime() + 10 * 60 * 1000,
        -2,
      );
    });

    it('should log an error and capture exception if alert creation fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      const mockError = new Error('Alert creation failed');

      jest.spyOn(AlertModel.prototype, 'save').mockRejectedValue(mockError);

      await service.sendAlertToAutoCheckout10minsFromNow(
        userId,
        calendarId,
        courseId,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating EVENT_ENDED_CHECKOUT_STAFF alert in cron job',
        mockError,
      );
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });

    it('should log an error and capture message if alert is not created', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;

      jest.spyOn(AlertModel.prototype, 'save').mockResolvedValue(null);

      await service.sendAlertToAutoCheckout10minsFromNow(
        userId,
        calendarId,
        courseId,
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error creating EVENT_ENDED_CHECKOUT_STAFF alert in cron job',
      );
      expect(schedulerRegistry.addCronJob).not.toHaveBeenCalled();
    });
  });

  describe('autoCheckout', () => {
    it('should check out the user if the alert is not resolved', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];

      // Mock QueueModel.query for SELECT and DELETE
      const queueQuerySpy = jest
        .spyOn(QueueModel, 'query')
        .mockImplementation((query, params) => {
          if (query.trim().startsWith('SELECT')) {
            // First call: SELECT query
            return Promise.resolve(mockCheckedInQueues);
          } else if (query.trim().startsWith('DELETE')) {
            // Second call: DELETE query
            return Promise.resolve();
          }
          return Promise.resolve();
        });

      // Mock AlertModel.findOneOrFail
      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;
      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      // Mock resolveQuestions
      const resolveQuestionsSpy = jest
        .spyOn(service.questionService, 'resolveQuestions')
        .mockResolvedValue();

      // Mock queueCleanService.promptStudentsToLeaveQueue
      jest
        .spyOn(service.queueCleanService, 'promptStudentsToLeaveQueue')
        .mockResolvedValue();

      // Mock EventModel.create().save()
      const mockEvent = {
        save: jest.fn().mockResolvedValue({}),
      } as unknown as EventModel;
      jest.spyOn(EventModel, 'create').mockReturnValue(mockEvent);

      // Call the method under test
      await service.autoCheckout(userId, calendarId, courseId, alertId);

      // Assertions
      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(resolveQuestionsSpy).toHaveBeenCalledWith(1, userId);
      expect(
        service.queueCleanService.promptStudentsToLeaveQueue,
      ).toHaveBeenCalledWith(1);
      expect(mockEvent.save).toHaveBeenCalled();
      expect(mockAlert.save).toHaveBeenCalled();
    });

    it('should create a new cron job if the alert is resolved', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      const mockAlert = {
        id: alertId,
        resolved: new Date(),
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;
      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.running).toBe(true);
      // 10 minutes from now (+/- 2mins for test execution time)
      expect(job.nextDate().toJSDate().getTime()).toBeCloseTo(
        new Date().getTime() + 10 * 60 * 1000,
        -2,
      );
    });

    it('should log an error and capture exception if checking if user is checked in fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockError = new Error('Query failed');
      jest.spyOn(QueueModel, 'query').mockRejectedValue(mockError);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking if user is checked in in cron job',
        mockError,
      );
    });

    it('should log an error and capture exception if getting alert fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      const mockError = new Error('Alert not found');
      jest.spyOn(AlertModel, 'findOneOrFail').mockRejectedValue(mockError);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error getting auto-checkout alert in cron job',
        mockError,
      );
    });

    it('should log an error and capture exception if resolving questions fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;
      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      const mockError = new Error('Resolve questions failed');
      jest
        .spyOn(service.questionService, 'resolveQuestions')
        .mockRejectedValue(mockError);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(service.questionService.resolveQuestions).toHaveBeenCalledWith(
        1,
        userId,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error resolving questions in cron job',
        mockError,
      );
    });

    it('should log an error and capture exception if checking out user fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];
      jest
        .spyOn(QueueModel, 'query')
        .mockResolvedValueOnce(mockCheckedInQueues);

      const mockAlert = {
        id: alertId,
        resolved: null,
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;
      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      jest
        .spyOn(service.questionService, 'resolveQuestions')
        .mockResolvedValue();

      const mockError = new Error('Checkout failed');
      jest.spyOn(QueueModel, 'query').mockRejectedValueOnce(mockError);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(service.questionService.resolveQuestions).toHaveBeenCalledWith(
        1,
        userId,
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error checking out user in cron job',
        mockError,
      );
    });

    it('should log an error and capture message if alert is resolved after 10min mark', async () => {
      const userId = 1;
      const calendarId = 1;
      const courseId = 1;
      const alertId = 1;

      const mockCheckedInQueues = [{ queueId: 1 }];
      jest.spyOn(QueueModel, 'query').mockResolvedValue(mockCheckedInQueues);

      const mockAlert = {
        id: alertId,
        resolved: new Date(new Date().getTime() - 15 * 60 * 1000), // 15 minutes ago
        save: jest.fn().mockResolvedValue(true),
      } as unknown as AlertModel;
      jest.spyOn(AlertModel, 'findOneOrFail').mockResolvedValue(mockAlert);

      await service.autoCheckout(userId, calendarId, courseId, alertId);

      expect(QueueModel.query).toHaveBeenCalledWith(expect.any(String), [
        userId,
      ]);
      expect(AlertModel.findOneOrFail).toHaveBeenCalledWith({
        where: { id: alertId },
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Alert was somehow resolved after 10min mark in cron job',
      );
    });
  });

  describe('deleteAutoCheckoutCronJob', () => {
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should delete a cron job', async () => {
      const userId = 1;
      const calendarId = 1;
      const jobName = `auto-checkout-${userId}-${calendarId}`;

      const cronJobs = new Map();
      cronJobs.set(jobName, new CronJob('* * * * *', () => {}));
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.deleteAutoCheckoutCronJob(userId, calendarId);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(jobName);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Deleted cron job with name ${jobName}`,
      );
    });

    it('should handle non-existent cron job', async () => {
      const userId = 1;
      const calendarId = 1;
      const jobName = `auto-checkout-${userId}-${calendarId}`;

      const cronJobs = new Map();
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.deleteAutoCheckoutCronJob(userId, calendarId);

      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Cron job with name ${jobName} does not exist`,
      );
    });

    it('should skip deletion if job does not exist and skipIfNotExists is true', async () => {
      const userId = 1;
      const calendarId = 1;
      const jobName = `auto-checkout-${userId}-${calendarId}`;

      const cronJobs = new Map();
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.deleteAutoCheckoutCronJob(userId, calendarId, true);

      expect(schedulerRegistry.deleteCronJob).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log an error if deletion fails', async () => {
      const userId = 1;
      const calendarId = 1;
      const jobName = `auto-checkout-${userId}-${calendarId}`;

      const cronJobs = new Map();
      cronJobs.set(jobName, new CronJob('* * * * *', () => {}));
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);
      jest.spyOn(schedulerRegistry, 'deleteCronJob').mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      await service.deleteAutoCheckoutCronJob(userId, calendarId);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(jobName);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error deleting cron job with name ${jobName}`,
        expect.any(Error),
      );
    });
  });
});
