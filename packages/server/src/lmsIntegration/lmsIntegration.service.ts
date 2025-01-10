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

export enum LMSGet {
  Course,
  Students,
  Assignments,
  Announcements,
}

export enum LMSSave {
  Assignments,
  Announcements,
}

export enum LMSUpload {
  Assignments,
  Announcements,
}

@Injectable()
export class LMSIntegrationService {
  constructor(
    @Inject(LMSIntegrationAdapter)
    private integrationAdapter: LMSIntegrationAdapter,
  ) {}

  lmsStatusToHttpStatus(status: LMSApiResponseStatus): HttpStatus {
    switch (status) {
      case LMSApiResponseStatus.InvalidKey:
        return HttpStatus.UNAUTHORIZED;
      case LMSApiResponseStatus.InvalidPlatform:
        return HttpStatus.NOT_FOUND;
      case LMSApiResponseStatus.None:
      case LMSApiResponseStatus.Error:
      case LMSApiResponseStatus.InvalidCourseId:
      case LMSApiResponseStatus.InvalidConfiguration:
      default:
        return HttpStatus.BAD_REQUEST;
    }
  }

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

  async getItems(courseId: number, type: LMSGet) {
    const adapter = await this.getAdapter(courseId);
    let retrieved: any = null;
    let retrievalStatus: LMSApiResponseStatus = LMSApiResponseStatus.None;

    switch (type) {
      case LMSGet.Students: {
        const { status, students } = await adapter.getStudents();
        retrieved = students;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Assignments: {
        const { status, assignments } = await adapter.getAssignments();
        retrieved = assignments;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Announcements: {
        const { status, announcements } = await adapter.getAnnouncements();
        retrieved = announcements;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Course: {
        const { status, course } = await adapter.getCourse();
        retrieved = course;
        retrievalStatus = status;
        break;
      }
    }

    if (retrievalStatus != LMSApiResponseStatus.Success) {
      throw new HttpException(
        retrievalStatus,
        this.lmsStatusToHttpStatus(retrievalStatus),
      );
    }

    return retrieved;
  }

  async saveItems(courseId: number, type: LMSSave, ids?: number[]) {
    const adapter = await this.getAdapter(courseId);
    let saveStatus: LMSApiResponseStatus = LMSApiResponseStatus.None;
    let data: any = null;

    switch (type) {
      case LMSSave.Announcements: {
        const { status, announcements } = await adapter.saveAnnouncements(ids);
        saveStatus = status;
        data = announcements;
        break;
      }
      case LMSSave.Assignments: {
        const { status, assignments } = await adapter.saveAssignments(ids);
        saveStatus = status;
        data = assignments;
        break;
      }
    }

    if (saveStatus != LMSApiResponseStatus.Success) {
      throw new HttpException(
        saveStatus,
        this.lmsStatusToHttpStatus(saveStatus),
      );
    }

    return data;
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

  async uploadAnnouncements(courseId: number, ids?: number[]) {
    // TODO: Like all of this
  }
}
