import { Connection } from 'typeorm';
import { LMSIntegrationService } from './lmsIntegration.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import {
  LMSIntegrationAdapter,
  TestLMSAdapter,
} from './lmsIntegration.adapter';
import {
  CourseFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
} from '../../test/util/factories';

describe('LmsIntegrationService', () => {
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
      expect(adapterResult instanceof TestLMSAdapter).toBeTruthy();
      expect(adapterResult.isImplemented()).toBeTruthy();
    });
  });
});
