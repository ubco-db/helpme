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
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSAssignment,
  LMSAnnouncement,
} from '@koh/common';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { UserModel } from '../profile/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 } from 'uuid';
import * as Sentry from '@sentry/browser';

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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resynchronizeCourseIntegrations() {
    const courses = await LMSCourseIntegrationModel.find({
      lmsSynchronize: true,
    });
    for (const course of courses) {
      await this.syncDocuments(course.courseId).catch((err) => {
        console.error(
          `Failed to synchronize Canvas LMS for HelpMe course ${course.courseId}`,
          err,
        );
        Sentry.captureException(err);
      });
    }
  }

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
    rootUrl: string,
    apiPlatform: LMSIntegrationPlatform,
  ) {
    let integration = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: organizationId, apiPlatform: apiPlatform },
    });
    let isUpdate = false;
    if (integration) {
      integration.rootUrl = rootUrl;
      isUpdate = true;
    } else {
      integration = new LMSOrganizationIntegrationModel();
      integration.organizationId = organizationId;
      integration.apiPlatform = apiPlatform;
      integration.rootUrl = rootUrl;
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
    integration: LMSCourseIntegrationModel,
    orgIntegration: LMSOrganizationIntegrationModel,
    apiKeyExpiryDeleted = false,
    apiCourseId?: string,
    apiKey?: string,
    apiKeyExpiry?: Date,
  ) {
    if (
      integration.orgIntegration.apiPlatform != orgIntegration.apiPlatform ||
      (apiCourseId != undefined && integration.apiCourseId != apiCourseId)
    ) {
      // If the integration changes to another platform, clear out the previously saved assignments
      // Or: if the apiCourseId changes, the information is no longer relevant - clear out old documents
      await this.clearDocuments(
        integration.courseId,
        orgIntegration.apiPlatform,
      );
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
    if (integration?.orgIntegration == undefined) {
      throw new HttpException(LMSApiResponseStatus.InvalidConfiguration, 404);
    }
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
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Assignments,
        );
        for (let idx = 0; idx < assignments.length; idx++) {
          const found = items.find(
            (i) => i.id == assignments[idx].id,
          ) as unknown as LMSAssignmentModel;
          if (found) {
            assignments[idx] = {
              id: found.id,
              name: found.name,
              description: found.description,
              due: found.due,
              modified: assignments[idx].modified ?? found.modified,
              uploaded: found.uploaded,
              syncEnabled: found.syncEnabled,
            };
          }
        }
        retrieved = assignments;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Announcements: {
        const { status, announcements } = await adapter.getAnnouncements();
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Announcements,
        );
        for (let idx = 0; idx < announcements.length; idx++) {
          const found = items.find(
            (i) => i.id == announcements[idx].id,
          ) as unknown as LMSAnnouncementModel;
          if (found) {
            announcements[idx] = {
              id: found.id,
              title: found.title,
              message: found.message,
              posted: found.posted,
              modified: announcements[idx].modified ?? found.modified,
              uploaded: found.uploaded,
              syncEnabled: found.syncEnabled,
            };
          }
        }
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

  async getDocumentModel(type: LMSUpload) {
    const model = (() => {
      switch (type) {
        case LMSUpload.Announcements:
          return LMSAnnouncementModel;
        case LMSUpload.Assignments:
          return LMSAssignmentModel;
      }
    })();

    if (!model || !model.find) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.invalidDocumentType,
        HttpStatus.BAD_REQUEST,
      );
    }

    return model;
  }

  async getDocumentModelAndItems(
    courseId: number,
    type: LMSUpload,
    platforms?: LMSIntegrationPlatform[],
  ) {
    const model = await this.getDocumentModel(type);

    const qb = model
      .createQueryBuilder('aModel')
      .select()
      .where('aModel.courseId = :courseId', { courseId });

    if (platforms) {
      qb.andWhere('aModel.lmsSource IN (:...platforms)', { platforms });
    } else {
      qb.andWhere('aModel.syncEnabled = true');
    }

    return {
      model,
      items: await qb.getMany(),
    };
  }

  async syncDocuments(courseId: number) {
    const adapter = await this.getAdapter(courseId);
    if (!adapter.isImplemented()) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
        HttpStatus.BAD_REQUEST,
      );
    }

    for (const type of Object.keys(LMSUpload)
      .filter((k: any) => !isNaN(k))
      .map((k) => parseInt(k))) {
      let result: {
        status: LMSApiResponseStatus;
        assignments?: LMSAssignment[];
        announcements?: LMSAnnouncement[];
      };

      const modelAndPersisted = await this.getDocumentModelAndItems(
        courseId,
        type,
      );
      const model = modelAndPersisted.model;
      switch (type) {
        case LMSUpload.Assignments:
          result = await adapter.getAssignments();
          result.assignments = result.assignments.filter(
            (a) =>
              (a.description != undefined && a.description.trim() != '') ||
              a.due != undefined,
          );
          break;
        case LMSUpload.Announcements:
          result = await adapter.getAnnouncements();
          break;
        default:
          result = { status: LMSApiResponseStatus.Error };
          break;
      }

      if (result.status != LMSApiResponseStatus.Success) {
        throw new HttpException(
          result.status,
          this.lmsStatusToHttpStatus(result.status),
        );
      }

      let items: (
        | LMSAnnouncement
        | LMSAnnouncementModel
        | LMSAssignment
        | LMSAssignmentModel
      )[];
      switch (type) {
        case LMSUpload.Assignments:
          items = result.assignments;
          break;
        case LMSUpload.Announcements:
          items = result.announcements;
          break;
      }

      let persistedItems: (LMSAnnouncementModel | LMSAssignmentModel)[] =
        modelAndPersisted.items;

      const toRemove: (LMSAnnouncementModel | LMSAssignmentModel)[] =
        persistedItems.filter((i0) => !items.find((i1) => i1.id == i0.id));
      if (toRemove.length > 0) {
        const toRemoveIds = toRemove.map((i) => i.id);
        persistedItems = persistedItems.filter((i) =>
          toRemoveIds.includes(i.id),
        );
        await this.clearSpecificDocuments(courseId, toRemove, model);
      }

      for (let i = 0; i < items.length; i++) {
        const found = persistedItems.find((p) => p.id == items[i].id);
        if (found) {
          items[i] = found;
        }
      }

      if (items.length == 0) continue;

      const tempUser = await UserModel.create({
        email: 'tempemail@example.com',
      }).save();
      const token = await ChatTokenModel.create({
        user: tempUser,
        token: v4(),
        max_uses: items.length,
      }).save();

      const statuses: LMSFileUploadResponse[] = [];
      for (const item of items) {
        statuses.push(
          await this.uploadDocument(courseId, item, token, type, adapter),
        );
      }

      await ChatTokenModel.remove(token);
      await UserModel.remove(tempUser);

      const validIds = statuses.filter((u) => u.success).map((u) => u.id);
      const toSave = items.filter((u) => validIds.includes(u.id));

      const entities = toSave
        .map((i) => {
          const chatbotDocumentId =
            'chatbotDocumentId' in i && i.chatbotDocumentId != undefined
              ? i.chatbotDocumentId
              : statuses.find((u) => u.id == i.id)?.documentId;

          switch (type) {
            case LMSUpload.Announcements:
              const ann = i as LMSAnnouncement;
              return (model as typeof LMSAnnouncementModel).create({
                id: ann.id,
                title: ann.title,
                message: ann.message,
                posted: ann.posted,
                chatbotDocumentId: chatbotDocumentId,
                uploaded: new Date(),
                modified:
                  ann.modified != undefined
                    ? new Date(ann.modified)
                    : new Date(),
                courseId: courseId,
                lmsSource: adapter.getPlatform(),
              }) as LMSAnnouncementModel;
            case LMSUpload.Assignments:
              const asg = i as LMSAssignment;
              return (model as typeof LMSAssignmentModel).create({
                id: asg.id,
                name: asg.name,
                description: asg.description ?? '',
                due: asg.due,
                chatbotDocumentId: chatbotDocumentId,
                uploaded: new Date(),
                courseId: courseId,
                modified:
                  asg.modified != undefined
                    ? new Date(asg.modified)
                    : new Date(),
                lmsSource: adapter.getPlatform(),
              }) as LMSAssignmentModel;
            default:
              return undefined;
          }
        })
        .filter((e) => e != undefined) as
        | LMSAssignmentModel[]
        | LMSAnnouncementModel[];

      switch (type) {
        case LMSUpload.Announcements:
          await (model as typeof LMSAnnouncementModel).save(
            entities as LMSAnnouncementModel[],
          );
          break;
        case LMSUpload.Assignments:
          await (model as typeof LMSAssignmentModel).save(
            entities as LMSAssignmentModel[],
          );
          break;
      }
    }
  }

  async clearDocuments(courseId: number, exceptIn?: LMSIntegrationPlatform) {
    for (const type of Object.keys(LMSUpload)
      .filter((k: any) => !isNaN(k))
      .map((k) => parseInt(k))) {
      const platforms = Object.keys(LMSIntegrationPlatform)
        .filter((k: any) => !isNaN(k))
        .map((k) => k as unknown as LMSIntegrationPlatform)
        .filter((p) => p != exceptIn);

      const { model, items } = await this.getDocumentModelAndItems(
        courseId,
        type,
        exceptIn != undefined ? platforms : undefined,
      );

      if (items.length == 0) continue;

      await this.clearSpecificDocuments(courseId, items, model);
    }
  }

  async clearSpecificDocuments(
    courseId: number,
    items: (LMSAssignmentModel | LMSAnnouncementModel)[],
    model: typeof LMSAssignmentModel | typeof LMSAnnouncementModel,
  ) {
    const tempUser = await UserModel.create({
      email: 'tempemail@example.com',
    }).save();
    const token = await ChatTokenModel.create({
      user: tempUser,
      token: v4(),
      max_uses: items.length,
    }).save();

    const statuses: LMSFileUploadResponse[] = [];
    for (const item of items) {
      statuses.push(await this.deleteDocument(courseId, item, token));
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

    const successfulIds = statuses.filter((s) => s.success).map((s) => s.id);
    await model.remove(items.filter((i) => successfulIds.includes(i.id)));
  }

  async singleDocOperation(
    courseId: number,
    item: LMSAnnouncementModel | LMSAssignmentModel,
    type: LMSUpload,
    action: 'Sync' | 'Clear',
  ) {
    switch (action) {
      case 'Sync':
        return await this.syncDocument(courseId, item, type);
      case 'Clear':
        return await this.clearDocument(courseId, item, type);
    }
  }

  private async syncDocument(
    courseId: number,
    item: LMSAnnouncementModel | LMSAssignmentModel,
    type: LMSUpload,
  ) {
    const adapter = await this.getAdapter(courseId);
    if (!adapter.isImplemented()) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.noLMSIntegration,
        HttpStatus.BAD_REQUEST,
      );
    }

    const model = await this.getDocumentModel(type);

    const tempUser = await UserModel.create({
      email: 'tempemail@example.com',
    }).save();
    const token = await ChatTokenModel.create({
      user: tempUser,
      token: v4(),
      max_uses: 1,
    }).save();

    const status = await this.uploadDocument(
      courseId,
      item,
      token,
      type,
      adapter,
    );

    if (status.success) {
      item.chatbotDocumentId = item.chatbotDocumentId ?? status.documentId;
      item.uploaded = new Date();
      item.syncEnabled = true;
      await model.upsert(item, ['id', 'courseId']);
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

    return status.success;
  }

  private async clearDocument(
    courseId: number,
    item: LMSAnnouncementModel | LMSAssignmentModel,
    type: LMSUpload,
  ) {
    const model = await this.getDocumentModel(type);

    const tempUser = await UserModel.create({
      email: 'tempemail@example.com',
    }).save();
    const token = await ChatTokenModel.create({
      user: tempUser,
      token: v4(),
      max_uses: 1,
    }).save();

    const status = await this.deleteDocument(courseId, item, token);

    if (status.success) {
      item.chatbotDocumentId = null;
      item.uploaded = null;
      item.syncEnabled = false;
      await model.upsert(item, ['id', 'courseId']);
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

    return status.success;
  }

  private async uploadDocument(
    courseId: number,
    item:
      | LMSAnnouncement
      | LMSAssignment
      | LMSAssignmentModel
      | LMSAnnouncementModel,
    token: ChatTokenModel,
    type: LMSUpload,
    adapter: AbstractLMSAdapter,
  ): Promise<LMSFileUploadResponse> {
    let documentText: string | undefined = undefined;
    switch (type) {
      case LMSUpload.Announcements: {
        const a = item as LMSAnnouncement;
        documentText = `(Course Announcement)\n Title: ${a.title}\nContent: ${a.message}\nPosted: ${a.posted.getTime()}${a.modified != undefined ? `\nModified: ${a.modified.getTime()}` : ''}`;
        break;
      }
      case LMSUpload.Assignments: {
        const a = item as any as LMSAssignment;
        documentText = `(Course Assignment)\n Name: ${a.name}\n${a.due != undefined ? `Due Date: ${a.due.toLocaleDateString()}\n` : 'Due Date: No due date\n'}${a.description && `Description: ${a.description}`}`;
        break;
      }
      default:
        return {
          id: item.id,
          success: false,
        } as LMSFileUploadResponse;
    }

    if (!documentText) {
      return {
        id: item.id,
        success: false,
      };
    }

    const computedDocLink = adapter.getDocumentLink(item.id, type);
    if (computedDocLink) {
      documentText = documentText.concat(`\nPage Link: ${computedDocLink}`);
    }

    if (
      'chatbotDocumentId' in item &&
      item.chatbotDocumentId != undefined &&
      item.uploaded != undefined &&
      item.modified != undefined &&
      new Date(item.modified).getTime() < new Date(item.uploaded).getTime()
    ) {
      return {
        id: item.id,
        success: true,
        documentId: item.chatbotDocumentId,
      };
    }

    const metadata: any = {
      name: `LMS Resource`,
      type: 'inserted_lms_document',
    };

    const reqOptions = {
      method:
        'chatbotDocumentId' in item && item.chatbotDocumentId != undefined
          ? 'PATCH'
          : 'POST',
      body: JSON.stringify({
        documentText: documentText,
        metadata: metadata,
      }),
      headers: {
        'Content-Type': 'application/json',
        HMS_API_TOKEN: token.token,
      },
    };

    const thenFx = (response: Response) => {
      if (response.ok) {
        if (reqOptions.method == 'PATCH') {
          return {
            id: item.id,
            success: true,
            documentId: (item as LMSAssignmentModel | LMSAnnouncementModel)
              .chatbotDocumentId,
          } as LMSFileUploadResponse;
        } else {
          return response.json();
        }
      } else {
        throw new HttpException(response.statusText, response.status);
      }
    };

    return await fetch(
      'chatbotDocumentId' in item && item.chatbotDocumentId != undefined
        ? `http://localhost:3003/chat/${courseId}/${item.chatbotDocumentId}/documentChunk`
        : `http://localhost:3003/chat/${courseId}/documentChunk`,
      reqOptions,
    )
      .then(thenFx)
      .then((response): LMSFileUploadResponse => {
        if (reqOptions.method == 'PATCH') return response;
        const persistedDoc = response as {
          id: string;
          pageContent: string;
          metadata: any;
        };
        return {
          id: item.id,
          success: true,
          documentId: persistedDoc.id,
        };
      })
      .catch((_error) => {
        return {
          id: item.id,
          success: false,
        } as LMSFileUploadResponse;
      });
  }

  private async deleteDocument(
    courseId: number,
    item: LMSAnnouncementModel | LMSAssignmentModel,
    token: ChatTokenModel,
  ) {
    const reqOptions = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        HMS_API_TOKEN: token.token,
      },
    };

    const thenFx = (response: Response): LMSFileUploadResponse => {
      if (response.ok || response.status == 404) {
        // 404 means it's already been deleted
        return {
          id: item.id,
          success: true,
        };
      } else {
        throw new Error();
      }
    };

    return await fetch(
      `http://localhost:3003/chat/${courseId}/documentChunk/${item.chatbotDocumentId}`,
      reqOptions,
    )
      .then(thenFx)
      .catch((_error): LMSFileUploadResponse => {
        return {
          id: item.id,
          success: false,
        };
      });
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
        sectionGroupName: lmsIntegration.course.sectionGroupName,
        semesterId: lmsIntegration.course.semesterId,
        enabled: lmsIntegration.course.enabled,
      } satisfies CoursePartial,
      apiCourseId: lmsIntegration.apiCourseId,
      apiKeyExpiry: lmsIntegration.apiKeyExpiry,
      lmsSynchronize: lmsIntegration.lmsSynchronize,
      isExpired:
        lmsIntegration.apiKeyExpiry != undefined &&
        new Date(lmsIntegration.apiKeyExpiry).getTime() < new Date().getTime(),
    } satisfies LMSCourseIntegrationPartial;
  }
}
