import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import {
  ERROR_MESSAGES,
  LMSApiResponseStatus,
  LMSFileUploadResponse,
  LMSFileUploadResult,
} from '@koh/common';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { v4 } from 'uuid';
import { UserModel } from '../profile/user.entity';

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

    const { status, items } = await adapter.saveItems(type, ids);

    if (status != LMSApiResponseStatus.Success) {
      throw new HttpException(status, this.lmsStatusToHttpStatus(status));
    }

    return items;
  }

  async uploadDocuments(
    user: UserModel,
    courseId: number,
    type: LMSUpload,
    ids?: number[],
  ) {
    const adapter = await this.getAdapter(courseId);
    if (!adapter.isImplemented()) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
        HttpStatus.BAD_REQUEST,
      );
    }

    const model = (() => {
      switch (type) {
        case LMSUpload.Announcements:
          return LMSAnnouncementModel;
        case LMSUpload.Assignments:
          return LMSAssignmentModel;
      }
    })();

    if (!model.find) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.invalidDocumentType,
        HttpStatus.BAD_REQUEST,
      );
    }

    const qb = model
      .createQueryBuilder('aModel')
      .select()
      .where('aModel.courseId = :courseId', { courseId });

    if (ids != undefined) {
      qb.andWhere('aModel.id IN :...ids', { ids });
    }
    const items = await qb.getMany();

    const metadata: any = {
      name: 'Manually Inserted Information',
      type: 'inserted_document',
    };

    const converted = items.map((i) => {
      switch (type) {
        case LMSUpload.Announcements: {
          const a = i as any as LMSAnnouncementModel;
          return {
            id: a.id,
            documentId: a.chatbotDocumentId,
            documentText: `(Announcement) Title: ${a.title}\nContent: ${a.message}\nPosted: ${a.posted.getTime()}${a.modified != undefined ? `\nModified: ${a.modified.getTime()}` : ''}`,
            metadata,
          };
        }
        case LMSUpload.Assignments: {
          const a = i as any as LMSAssignmentModel;
          return {
            id: a.id,
            documentId: a.chatbotDocumentId,
            documentText: `Assignment: ${a.name}\nDue Date: ${a.due.toLocaleDateString()}\nDescription: ${a.description}`,
            metadata,
          };
        }
        default: {
          return {
            id: -1,
            documentId: undefined,
            documentText: '',
            metadata,
          };
        }
      }
    });

    const token = await ChatTokenModel.create({
      user: user,
      token: v4(),
      max_uses: converted.length,
    }).save();

    const statuses: LMSFileUploadResponse[] = [];
    for (const item of converted) {
      if (!item.documentText) {
        statuses.push({
          id: item.id,
          type: type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
          success: false,
        });
        continue;
      }

      const reqOptions = {
        body: JSON.stringify({
          documentText: item.documentText,
          metadata: item.metadata,
        }),
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: token.token,
        },
      };

      const thenFx = (response: Response) => {
        if (response.ok) {
          if (item.documentId != undefined) {
            statuses.push({
              id: item.id,
              type:
                type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
              success: true,
              documentId: item.documentId,
            });
            return { completed: true };
          } else {
            return response.json();
          }
        } else {
          statuses.push({
            id: item.id,
            type:
              type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
            success: false,
          });
          throw new Error();
        }
      };

      if (item.documentId != undefined) {
        await fetch(
          `/chat/${courseId}/${item.documentId}/documentChunk`,
          reqOptions,
        )
          .then(thenFx)
          .catch((_) =>
            console.log('Failed to update uploaded document in the Chatbot'),
          );
      } else {
        await fetch(`/chat/${courseId}/documentChunk`, reqOptions)
          .then(thenFx)
          .then((json) => {
            if (json.completed == true) return;
            const persistedDoc = json as {
              id: string;
              pageContent: string;
              metadata: any;
            };
            statuses.push({
              id: item.id,
              type:
                type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
              success: true,
              documentId: persistedDoc.id,
            });
          })
          .catch((_) =>
            console.log('Failed to upload a document to the Chatbot'),
          );
      }
    }

    await ChatTokenModel.remove(token);

    const successful = statuses.filter(
      (s) => s.success && s.documentId != undefined,
    );
    if (successful.length == 0) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.failedToUpload,
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const status of successful) {
      const result = await model
        .createQueryBuilder('aModel')
        .update()
        .set({
          chatbotDocumentId: status.documentId,
          uploaded: new Date(),
        })
        .where('aModel.id = :id', { id: status.id })
        .execute();

      if (result.affected < 1) {
        status.success = false;
      }
    }

    return statuses.map((a) => {
      return {
        id: a.id,
        success: a.success,
      } as LMSFileUploadResult;
    });
  }
}
