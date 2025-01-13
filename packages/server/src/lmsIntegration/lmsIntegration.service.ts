import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import { LMSApiResponseStatus } from '@koh/common';
import { Inject, Injectable } from '@nestjs/common';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';

@Injectable()
export class LMSIntegrationService {
  constructor(
    @Inject(LMSIntegrationAdapter)
    private integrationAdapter: LMSIntegrationAdapter,
  ) {}

  async getAdapter(courseId: number): Promise<AbstractLMSAdapter | undefined> {
    const integration = await LMSCourseIntegrationModel.findOne(
      { courseId },
      { relations: ['orgIntegration'] },
    );
    return await this.integrationAdapter.getAdapter(integration);
  }

  async testConnection(
    orgIntegration: LMSOrganizationIntegrationModel,
    apiKey: string,
    apiCourseId: string,
  ): Promise<LMSApiResponseStatus> {
    const tempIntegration = new LMSCourseIntegrationModel();
    tempIntegration.apiKey = apiKey;
    tempIntegration.apiCourseId = apiCourseId;
    tempIntegration.orgIntegration = orgIntegration;

    const adapter = await this.integrationAdapter.getAdapter(tempIntegration);
    if (!adapter.isImplemented()) {
      return LMSApiResponseStatus.InvalidPlatform;
    }

    return (await adapter.getCourse()).status;
  }

  async getCourse(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    return (await adapter.getCourse()).course;
  }

  async getStudents(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    return (await adapter.getStudents()).students;
  }

  async getAssignments(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    return (await adapter.getAssignments()).assignments;
  }
}
