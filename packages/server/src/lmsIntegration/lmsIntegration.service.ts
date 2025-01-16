import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import {
  CoursePartial,
  ERROR_MESSAGES,
  LMSApiResponseStatus,
  LMSCourseIntegrationPartial,
  LMSFileUploadResponse,
  LMSFileResult,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
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

  public async upsertOrganizationLMSIntegration(
    organizationId: number,
    props: LMSOrganizationIntegrationPartial,
  ) {
    let integration = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: organizationId, apiPlatform: props.apiPlatform },
    });
    let isUpdate = false;
    if (integration) {
      integration.rootUrl = props.rootUrl;
      isUpdate = true;
    } else {
      integration = new LMSOrganizationIntegrationModel();
      integration.organizationId = organizationId;
      integration.apiPlatform = props.apiPlatform;
      integration.rootUrl = props.rootUrl;
    }
    await LMSOrganizationIntegrationModel.upsert(integration, [
      'organizationId',
      'apiPlatform',
    ]);
    return isUpdate
      ? `Successfully updated integration for ${integration.apiPlatform}`
      : `Successfully created integration for ${integration.apiPlatform}`;
  }

  public async createCourseLMSIntegration(
    orgIntegration: LMSOrganizationIntegrationModel,
    courseId: number,
    apiCourseId: string,
    apiKey: string,
    apiKeyExpiry?: Date,
  ) {
    const integration = new LMSCourseIntegrationModel();
    integration.orgIntegration = orgIntegration;
    integration.courseId = courseId;
    integration.apiKey = apiKey;
    integration.apiCourseId = apiCourseId;
    integration.apiKeyExpiry = apiKeyExpiry;
    await LMSCourseIntegrationModel.upsert(integration, ['courseId']);
    return `Successfully linked course with ${orgIntegration.apiPlatform}`;
  }

  public async updateCourseLMSIntegration(
    user: UserModel,
    integration: LMSCourseIntegrationModel,
    orgIntegration: LMSOrganizationIntegrationModel,
    apiKeyExpiryDeleted = false,
    apiCourseId?: string,
    apiKey?: string,
    apiKeyExpiry?: Date,
  ) {
    if (integration.orgIntegration.apiPlatform != orgIntegration.apiPlatform) {
      // If the integration changes to another platform, clear out the previously saved assignments
      const allAssignments = await LMSAssignmentModel.find({
        where: { courseId: integration.courseId },
      });
      const allAnnouncements = await LMSAnnouncementModel.find({
        where: { courseId: integration.courseId },
      });

      await this.removeDocuments(
        user,
        integration.courseId,
        LMSUpload.Announcements,
      );
      await this.removeDocuments(
        user,
        integration.courseId,
        LMSUpload.Assignments,
      );
      await LMSAssignmentModel.remove(allAssignments);
      await LMSAnnouncementModel.remove(allAnnouncements);
    }

    integration.orgIntegration = orgIntegration;
    integration.apiKey = apiKey ?? integration.apiKey;
    integration.apiCourseId = apiCourseId ?? integration.apiCourseId;
    integration.apiKeyExpiry = apiKeyExpiryDeleted
      ? null
      : (apiKeyExpiry ?? integration.apiKeyExpiry);

    await LMSCourseIntegrationModel.upsert(integration, ['courseId']);
    return `Successfully updated link with ${integration.orgIntegration.apiPlatform}`;
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
    if (!adapter.isImplemented())
      throw new HttpException(
        LMSApiResponseStatus.InvalidPlatform,
        HttpStatus.BAD_REQUEST,
      );

    const status = (await adapter.getCourse()).status;
    if (status != LMSApiResponseStatus.Success)
      throw new HttpException(status, this.lmsStatusToHttpStatus(status));

    return status;
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

  async getDocumentModelAndItems(
    courseId: number,
    type: LMSUpload,
    ids?: number[],
  ) {
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

    return { model, items: await qb.getMany() };
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

    const { status } = await adapter.saveItems(type, ids);

    if (status != LMSApiResponseStatus.Success) {
      throw new HttpException(status, this.lmsStatusToHttpStatus(status));
    }

    const { model, items } = await this.getDocumentModelAndItems(
      courseId,
      type,
      ids,
    );

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
            documentText: `Assignment: ${a.name}\n${a.due != undefined ? `Due Date: ${a.due.toLocaleDateString()}\n` : 'Due Date: No due date\n'}Description: ${a.description}`,
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
        method: 'POST',
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
          throw new Error();
        }
      };

      await fetch(
        item.documentId != undefined
          ? `/chat/${courseId}/${item.documentId}/documentChunk`
          : `/chat/${courseId}/documentChunk`,
        reqOptions,
      )
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
        .catch((error) => {
          statuses.push({
            id: item.id,
            type:
              type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
            success: false,
          });
          console.log(
            `Failed to upload a document to the Chatbot (${error.message})`,
          );
        });
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
      } as LMSFileResult;
    });
  }

  async removeDocuments(
    user: UserModel,
    courseId: number,
    type: LMSUpload,
    ids?: number[],
  ) {
    const { model, items } = await this.getDocumentModelAndItems(
      courseId,
      type,
      ids,
    );

    const token = await ChatTokenModel.create({
      user: user,
      token: v4(),
      max_uses: items.length,
    }).save();

    const statuses: LMSFileUploadResponse[] = [];
    for (const item of items) {
      const reqOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: token.token,
        },
      };

      const thenFx = (response: Response) => {
        if (response.ok) {
          statuses.push({
            id: item.id,
            type:
              type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
            success: true,
          });
        } else {
          throw new Error();
        }
      };

      await fetch(
        `/chat/${courseId}/documentChunk/${item.chatbotDocumentId}`,
        reqOptions,
      )
        .then(thenFx)
        .catch((error) => {
          statuses.push({
            id: item.id,
            type:
              type == LMSUpload.Announcements ? 'Announcement' : 'Assignment',
            success: false,
          });
          console.log(
            `Failed to remove a document from the Chatbot (${error.message})`,
          );
        });
    }

    const successfulIds = statuses.filter((s) => s.success).map((s) => s.id);
    await model.remove(items.filter((i) => successfulIds.includes(i.id)));

    await ChatTokenModel.remove(token);

    return statuses;
  }

  getPartialOrgLmsIntegration(lmsIntegration: LMSOrganizationIntegrationModel) {
    return {
      organizationId: lmsIntegration.organizationId,
      apiPlatform: lmsIntegration.apiPlatform,
      rootUrl: lmsIntegration.rootUrl,
      courseIntegrations:
        lmsIntegration.courseIntegrations?.map((cint) =>
          this.getPartialCourseLmsIntegration(cint, lmsIntegration.apiPlatform),
        ) ?? [],
    } satisfies LMSOrganizationIntegrationPartial;
  }

  getPartialCourseLmsIntegration(
    lmsIntegration: LMSCourseIntegrationModel,
    platform?: LMSIntegrationPlatform,
  ) {
    return {
      apiPlatform:
        platform ??
        lmsIntegration.orgIntegration?.apiPlatform ??
        ('None' as LMSIntegrationPlatform),
      courseId: lmsIntegration.courseId,
      course: {
        id: lmsIntegration.courseId,
        name: lmsIntegration.course.name,
      } satisfies CoursePartial,
      apiCourseId: lmsIntegration.apiCourseId,
      apiKeyExpiry: lmsIntegration.apiKeyExpiry,
      isExpired:
        lmsIntegration.apiKeyExpiry != undefined &&
        new Date(lmsIntegration.apiKeyExpiry).getTime() < new Date().getTime(),
    } satisfies LMSCourseIntegrationPartial;
  }
}
