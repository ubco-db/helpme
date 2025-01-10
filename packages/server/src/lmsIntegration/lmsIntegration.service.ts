import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import { ERROR_MESSAGES, LMSApiResponseStatus } from '@koh/common';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { In } from 'typeorm';

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

  async saveAssignments(courseId: number, ids?: number[]) {
    const adapter = await this.getAdapter(courseId);
    return await adapter.saveAssignments(ids);
  }

  async uploadAssignments(courseId: number, ids?: number[]) {
    const adapter = await this.getAdapter(courseId);
    if (!adapter.isImplemented()) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
        HttpStatus.BAD_REQUEST,
      );
    }

    const findOptions = ids != undefined ? { id: In(ids ?? []) } : {};

    const assignments = await LMSAssignmentModel.find({
      where: {
        courseId,
        ...findOptions,
      },
    });

    /**
     * TODO: Actually get these formatted into documents and into the Chatbot I guess?
     */
    const asRawText = assignments.map(
      (a) =>
        `Assignment: ${a.name}\nDue Date: ${a.due.toLocaleDateString()}\nDescription: ${a.description}`,
    );

    return;
  }
}
