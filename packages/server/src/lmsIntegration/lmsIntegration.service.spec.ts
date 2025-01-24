import { Connection } from 'typeorm';
import { LMSIntegrationService } from './lmsIntegration.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { LMSIntegrationAdapter } from './lmsIntegration.adapter';
import {
  CourseFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
} from '../../test/util/factories';
import { LMSIntegrationPlatform } from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';

/*
Note:
  The majority of methods in the LMSIntegrationService require external API calls.
  The only function that can be formally tested is the getAdapter() function.
*/
describe('LMSIntegrationService', () => {
  let service: LMSIntegrationService;
  let conn: Connection;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [LMSIntegrationService, LMSIntegrationAdapter],
    }).compile();

    service = module.get<LMSIntegrationService>(LMSIntegrationService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  describe('resynchronizeCourseIntegrations', () => {
    it('should call to sync documents of any courses with sync enabled', async () => {
      const org = await OrganizationFactory.create();
      const orgIntegration = await lmsOrgIntFactory.create({
        organization: org,
        rootUrl: 'example.ubc.ca',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const courses = [
        await CourseFactory.create(),
        await CourseFactory.create(),
        await CourseFactory.create(),
      ];
      for (const course of courses) {
        course.organizationCourse = await OrganizationCourseFactory.create({
          organization: org,
          course: course,
        });
        course.lmsIntegration = await lmsCourseIntFactory.create({
          course: course,
          apiCourseId: 'abc',
          apiKey: 'def',
          lmsSynchronize: course.id != 2,
          orgIntegration,
        });
      }

      const old = service.syncDocuments;
      const findSpy = jest.spyOn(LMSCourseIntegrationModel, 'find');
      service.syncDocuments = jest.fn(async (_courseId: number) => undefined);
      await service.resynchronizeCourseIntegrations();

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({ lmsSynchronize: true });

      expect(service.syncDocuments).toHaveBeenCalledTimes(2);
      let i = 1;
      for (const course of courses.filter(
        (c) => c.lmsIntegration.lmsSynchronize,
      )) {
        expect(service.syncDocuments).toHaveBeenNthCalledWith(i, course.id);
        ++i;
      }
      service.syncDocuments = old;
    });
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
});
