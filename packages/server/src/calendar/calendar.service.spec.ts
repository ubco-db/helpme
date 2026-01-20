import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BadRequestException } from '@nestjs/common';
import { CronJob } from 'cron';
import { QuestionService } from '../question/question.service';
import { NotificationService } from '../notification/notification.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { AlertModel } from '../alerts/alerts.entity';
import { AlertType, Role } from '@koh/common';
import { EventModel, EventType } from '../profile/event-model.entity';
import { QueueStaffModel } from '../queue/queue-staff/queue-staff.entity';
import { QueueStaffService } from 'queue/queue-staff/queue-staff.service';
import { DataSource } from 'typeorm';
import {
  AlertFactory,
  initFactoriesFromService,
  QueueFactory,
  UserFactory,
  QueueStaffFactory,
  CourseFactory,
  UserCourseFactory,
} from '../../test/util/factories';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('CalendarService', () => {
  let service: CalendarService;
  let schedulerRegistry: SchedulerRegistry;
  let dataSource: DataSource;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
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
          provide: QueueStaffService,
          useValue: {
            promptStudentsToLeaveQueue: jest.fn(),
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
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    dataSource = module.get<DataSource>(DataSource);

    const factories = module.get<FactoryService>(FactoryService);
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
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    jest.clearAllMocks();

    // Default spy behavior for these
    jest
      .spyOn(service, 'deleteAnyExistingAutoCheckoutLoopJobs')
      .mockImplementation(jest.fn());
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createAutoCheckoutCronJob', () => {
    it('should create a one-time cron job for non-recurring events', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user,
        course,
        role: Role.TA,
      });
      const calendarId = 1;
      const startDate = null;
      const endDate = null;
      // endTime = tomorrow
      const endTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
      const daysOfWeek: string[] = [];

      await service.createAutoCheckoutCronJob(
        user.id,
        calendarId,
        startDate,
        endDate,
        endTime,
        daysOfWeek,
        course.id,
      );

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.nextDate().toJSDate()).toEqual(endTime);
      expect(job.runOnce).toBeTruthy();
    });

    it('should not allow you to create a cron job for a date in the past (only for non-recurring events)', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user,
        course,
        role: Role.TA,
      });
      const calendarId = 1;
      const startDate = null;
      const endDate = null;
      // endTime = yesterday
      const endTime = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
      const daysOfWeek: string[] = [];

      await expect(
        service.createAutoCheckoutCronJob(
          user.id,
          calendarId,
          startDate,
          endDate,
          endTime,
          daysOfWeek,
          course.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a recurring cron job for recurring events', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const calendarId = 1;
      const startDate = new Date();
      const endDate = new Date();
      const endTime = new Date();
      const daysOfWeek = ['1', '2', '3'];

      await service.createAutoCheckoutCronJob(
        user.id,
        calendarId,
        startDate,
        endDate,
        endTime,
        daysOfWeek,
        course.id,
      );

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      const expectedCronTime = `${endTime.getMinutes()} ${endTime.getHours()} * * ${daysOfWeek.join(',')}`;
      expect(job.cronTime.source).toEqual(expectedCronTime);
      expect(job.runOnce).toBeFalsy();
    });

    it('should throw a BadRequestException for invalid event', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const calendarId = 1;
      const startDate = null;
      const endDate = new Date();
      const endTime = new Date();
      const daysOfWeek: string[] = [];

      await expect(
        service.createAutoCheckoutCronJob(
          user.id,
          calendarId,
          startDate,
          endDate,
          endTime,
          daysOfWeek,
          course.id,
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
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta });

      await service.initializeAutoCheckout(ta.id, 1, course.id);

      expect(sendAlertToAutoCheckout10minsFromNowSpy).toHaveBeenCalledWith(
        ta.id,
        1,
        course.id,
      );
    });

    it('should not send an alert if the user is not checked in', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });

      // No queue staff entry created

      await service.initializeAutoCheckout(ta.id, 1, course.id);

      expect(sendAlertToAutoCheckout10minsFromNowSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendAlertToAutoCheckout10minsFromNow', () => {
    it('should create an alert and schedule a cron job', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const calendarId = 1;

      await service.sendAlertToAutoCheckout10minsFromNow(
        ta.id,
        calendarId,
        course.id,
      );

      const alert = await AlertModel.findOne({
        where: {
          userId: ta.id,
          alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        },
      });
      expect(alert).toBeDefined();
      expect(alert.courseId).toEqual(course.id);

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
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const calendarId = 1;
      const jobName = `auto-checkout-loop-${ta.id}-${calendarId}`;

      // mock schedularRegistry.getCronJobs() to return a cron job with jobName
      const cronJobs = new Map();
      const mockCronJob = {
        stop: jest.fn(),
      };
      cronJobs.set(jobName, mockCronJob);
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      // restore mock to allow for deletion logic to run in full
      (
        service.deleteAnyExistingAutoCheckoutLoopJobs as jest.Mock
      ).mockRestore();

      await service.sendAlertToAutoCheckout10minsFromNow(
        ta.id,
        calendarId,
        course.id,
      );

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(jobName);

      const alert = await AlertModel.findOne({
        where: {
          userId: ta.id,
          alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        },
      });
      expect(alert).toBeDefined();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
    });
  });

  describe('autoCheckout', () => {
    it('should check out the user if the alert is not resolved', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta });

      const alert = await AlertFactory.create({
        user: ta,
        course: course,
        alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        payload: {},
      });
      // ensure null resolved for the test condition
      await AlertModel.update(alert.id, { resolved: null });

      const calendarId = 1;

      // Call the method under test
      await service.autoCheckout(ta.id, calendarId, course.id, alert.id);

      // Assertions
      const remainingStaff = await QueueStaffModel.findOne({
        where: { userId: ta.id, queueId: queue.id },
      });
      expect(remainingStaff).toBeNull();

      await alert.reload();
      expect(alert.resolved).not.toBeNull();

      expect(service.questionService.resolveQuestions).toHaveBeenCalledWith(
        queue.id,
        ta.id,
      );

      expect(
        service.queueStaffService.promptStudentsToLeaveQueue,
      ).toHaveBeenCalledWith(queue.id, expect.anything()); // verify it is called with manager

      const event = await EventModel.findOne({
        where: {
          eventType: EventType.TA_CHECKED_OUT_EVENT_END,
          userId: ta.id,
        },
      });
      expect(event).toBeDefined();
    });

    it('should create a new cron job if the alert is resolved', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta });

      const alert = await AlertFactory.create({
        user: ta,
        course: course,
        alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        payload: {},
      });
      // ensure resolved
      await AlertModel.update(alert.id, { resolved: new Date() });

      const calendarId = 1;

      await service.autoCheckout(ta.id, calendarId, course.id, alert.id);

      // Staff should still be there
      const remainingStaff = await QueueStaffModel.findOne({
        where: { userId: ta.id, queueId: queue.id },
      });
      expect(remainingStaff).toBeDefined();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
      expect(job.running).toBe(true);
    });

    it('should log an error and capture message if alert is resolved after 10min mark', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await UserCourseFactory.create({
        user: ta,
        course,
        role: Role.TA,
      });
      const queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta });

      const alert = await AlertFactory.create({
        user: ta,
        course: course,
        alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        payload: {},
      });
      // ensure resolved long ago
      const fifteenMinsAgo = new Date(new Date().getTime() - 15 * 60 * 1000);
      await AlertModel.update(alert.id, { resolved: fifteenMinsAgo });

      const calendarId = 1;

      await service.autoCheckout(ta.id, calendarId, course.id, alert.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Alert was somehow resolved after 10min mark in cron job',
      );
    });
  });

  describe('deleteAutoCheckoutCronJob', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
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
