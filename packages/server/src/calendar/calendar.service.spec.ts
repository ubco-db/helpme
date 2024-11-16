import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BadRequestException } from '@nestjs/common';
import { CronJob } from 'cron';
import { QuestionService } from 'question/question.service';
import { NotificationService } from 'notification/notification.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';

describe('CalendarService', () => {
  let service: CalendarService;
  let schedulerRegistry: SchedulerRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [
        CalendarService,
        QuestionService,
        NotificationService,
        {
          provide: SchedulerRegistry,
          useValue: {
            addCronJob: jest.fn(),
            deleteCronJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
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

  describe('deleteAutoCheckoutCronJob', () => {
    it('should delete a cron job', async () => {
      const userId = 1;
      const calendarId = 1;
      const jobName = `auto-checkout-${userId}-${calendarId}`;

      await service.deleteAutoCheckoutCronJob(userId, calendarId);

      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(jobName);
    });
  });
});
