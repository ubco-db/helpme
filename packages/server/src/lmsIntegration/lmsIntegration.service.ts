import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { Cache } from 'cache-manager';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';

@Injectable()
export class LMSIntegrationService {
  constructor(
    private connection: Connection,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(LMSIntegrationAdapter)
    private integrationAdapter: LMSIntegrationAdapter,
  ) {}

  private async getAdapter(
    courseId: number,
  ): Promise<AbstractLMSAdapter | undefined> {
    const integration = await LMSCourseIntegrationModel.findOne(
      { courseId },
      { relations: ['orgIntegration'] },
    );
    if (integration == undefined) return undefined;
    return await this.integrationAdapter.getAdapter(integration);
  }

  async getStudents(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    return await adapter.getStudents();
  }

  async getAssignments(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    return await adapter.getAssignments();
  }
}
