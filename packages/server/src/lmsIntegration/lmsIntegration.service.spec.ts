import { Connection } from 'typeorm';
import { LMSIntegrationService } from './lmsIntegration.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { LMSIntegrationAdapter } from './lmsIntegration.adapter';
import {
  CourseFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
} from '../../test/util/factories';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

/*
Note:
  The majority of methods in the LMSIntegrationService require external API calls.
  The only function that can be formally tested is the getAdapter() function.
*/
describe('LMSIntegrationService', () => {
  let service: LMSIntegrationService;
  let schedulerRegistry: SchedulerRegistry;
  let conn: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [
        LMSIntegrationService,
        LMSIntegrationAdapter,
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

    service = module.get<LMSIntegrationService>(LMSIntegrationService);
    schedulerRegistry = module.get<SchedulerRegistry>(SchedulerRegistry);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  describe('getAdapter', () => {
    it('retrieves valid adapter with existing case', async () => {
      const course = await CourseFactory.create({
        id: 1,
      });
      const organizationIntegration = await lmsOrgIntFactory.create();
      await lmsCourseIntFactory.create({
        orgIntegration: organizationIntegration,
        course: course,
        courseId: 1,
      });

      const adapterResult = await service.getAdapter(1);
      expect(adapterResult.isImplemented()).toBeTruthy();
    });
  });

  describe('createLMSSyncCronJob', () => {
    it('should create a single cron job for recurring synchronizations', async () => {
      const courseId = 1;

      const cronJobs = new Map();
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.createLMSSyncCronJob(courseId);

      expect(schedulerRegistry.addCronJob).toHaveBeenCalled();
      const job = (schedulerRegistry.addCronJob as jest.Mock).mock.calls[0][1];
      expect(job).toBeInstanceOf(CronJob);
    });
  });

  describe('deleteLMSSyncCronJobs', () => {
    it('should delete a cron job if found', async () => {
      const courseId = 1;
      const jobName = `lms_integration_sync_${courseId}`;

      const cronJobs = new Map();
      const mockCronJob = {
        stop: jest.fn(),
      };
      cronJobs.set(jobName, mockCronJob);
      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.deleteLMSSyncCronJobs([courseId], true);
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledTimes(1);
    });

    it('should fail to delete a cron job if not found', async () => {
      schedulerRegistry.deleteCronJob = jest.fn();

      const courseIds: number[] = [];
      const cronJobs = new Map();
      for (let i = 1; i < 4; i++) {
        courseIds.push(i);
        if (i != 2) {
          const mockCronJob = {
            stop: jest.fn(),
          };
          cronJobs.set(`lms_integration_sync_${i}`, mockCronJob);
        }
      }

      jest.spyOn(schedulerRegistry, 'getCronJobs').mockReturnValue(cronJobs);

      await service.deleteLMSSyncCronJobs(courseIds, true);
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledTimes(2);
    });
  });
});
