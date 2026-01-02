import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import {
  ChatbotDocumentAggregateResponse,
  CoursePartial,
  dropUndefined,
  ERROR_MESSAGES,
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSCourseIntegrationPartial,
  LMSFile,
  LMSFileUploadResponse,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  LMSPostResponseBody,
  LMSQuiz,
  LMSQuizAccessLevel,
  LMSResourceType,
  LMSSyncDocumentsResult,
  SupportedLMSFileTypes,
  UpsertLMSCourseParams,
  UpsertLMSOrganizationParams,
} from '@koh/common';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { LMSPageModel } from './lmsPage.entity';
import { LMSFileModel } from './lmsFile.entity';
import { LMSQuizModel } from './lmsQuiz.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as Sentry from '@sentry/browser';
import { convert } from 'html-to-text';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { Cache } from 'cache-manager';
import { LMSAccessTokenModel } from './lms-access-token.entity';
import { pick } from 'lodash';
import { LMSAuthStateModel } from './lms-auth-state.entity';
import { UserModel } from '../profile/user.entity';
import { io } from 'socket.io-client';
import {
  ChatbotResultEventName,
  ChatbotResultEvents,
  ChatbotResultWebSocket,
} from '../chatbot/intermediate-results/chatbot-result.websocket';
import { ClientSocket } from '../websocket/clientSocket';

export enum LMSGet {
  Course,
  Students,
  Assignments,
  Announcements,
  Pages,
  Files,
  Quizzes,
}

export enum LMSUpload {
  Assignments,
  Announcements,
  Pages,
  Files,
  Quizzes,
}

type ExtendedLMSItem = (
  | LMSAnnouncement
  | LMSAssignment
  | LMSPage
  | LMSFile
  | LMSQuiz
) & {
  chatbotDocumentId: string;
};

@Injectable()
export class LMSIntegrationService {
  private socket: ClientSocket;
  constructor(
    @Inject(LMSIntegrationAdapter)
    private integrationAdapter: LMSIntegrationAdapter,
    @Inject(ChatbotApiService)
    private chatbotApiService: ChatbotApiService,
    private chatbotResultWebSocket: ChatbotResultWebSocket,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const socket = io();
    this.socket = new ClientSocket(socket as any);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'CLEAR_LMS_AUTH_STATES' })
  async clearLMSAuthStates() {
    await LMSAuthStateModel.createQueryBuilder()
      .delete()
      .where(
        `(EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM lms_auth_state_model."createdAt")) > lms_auth_state_model."expiresInSeconds"`,
      )
      .execute();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resynchronizeCourseIntegrations() {
    const courses = await LMSCourseIntegrationModel.find({
      where: {
        lmsSynchronize: true,
      },
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

  LMSUploadToResourceType: Record<LMSUpload, LMSResourceType> = {
    [LMSUpload.Assignments]: LMSResourceType.ASSIGNMENTS,
    [LMSUpload.Announcements]: LMSResourceType.ANNOUNCEMENTS,
    [LMSUpload.Pages]: LMSResourceType.PAGES,
    [LMSUpload.Files]: LMSResourceType.FILES,
    [LMSUpload.Quizzes]: LMSResourceType.QUIZZES,
  };

  public async upsertOrganizationLMSIntegration(
    organizationId: number,
    props: UpsertLMSOrganizationParams,
  ) {
    let integration = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: organizationId, apiPlatform: props.apiPlatform },
      relations: {
        userAccessTokens: true,
      },
    });

    if (integration != undefined && !props.rootUrl) {
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsIntegrationUrlRequired,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (props.rootUrl.startsWith('https') || props.rootUrl.startsWith('http'))
      throw new HttpException(
        ERROR_MESSAGES.lmsController.lmsIntegrationProtocolIncluded,
        HttpStatus.BAD_REQUEST,
      );

    const isUpdate = integration != undefined;
    if (integration) {
      // Invalidate any tokens that are out-of-date with settings
      if (
        (props.clientId && integration.clientId != props.clientId) ||
        (props.clientSecret && integration.clientSecret != props.clientSecret)
      ) {
        for (let token of integration.userAccessTokens) {
          try {
            token = Object.assign(token, {
              organizationIntegration: integration,
            });
            await AbstractLMSAdapter.logoutAuth(token);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_ignored) {}
        }
        await LMSAccessTokenModel.remove(integration.userAccessTokens);
      }

      await LMSOrganizationIntegrationModel.save({
        ...dropUndefined(props),
        organizationId: organizationId,
        apiPlatform: props.apiPlatform,
      });
    } else {
      integration = await LMSOrganizationIntegrationModel.create({
        organizationId,
        ...dropUndefined(props),
      }).save();
    }

    return isUpdate
      ? `Successfully updated integration for ${integration.apiPlatform}`
      : `Successfully created integration for ${integration.apiPlatform}`;
  }

  public async createAccessToken(
    user: UserModel,
    organizationIntegration: LMSOrganizationIntegrationModel,
    raw: LMSPostResponseBody,
  ): Promise<LMSAccessTokenModel> {
    let id: number | undefined;
    try {
      const token = await LMSAccessTokenModel.create({
        user,
        organizationIntegration,
      }).save();
      id = token.id;
      return await token.encryptToken(raw);
    } catch (err) {
      if (id) {
        await LMSAccessTokenModel.delete({
          id,
        });
      }
      throw err;
    }
  }

  public async destroyAccessToken(token: LMSAccessTokenModel) {
    const result = await AbstractLMSAdapter.logoutAuth(token);
    if (result) {
      await LMSAccessTokenModel.remove(token);
    }
    return result;
  }

  public async createCourseLMSIntegration(
    orgIntegration: LMSOrganizationIntegrationModel,
    courseId: number,
    props: Omit<UpsertLMSCourseParams, 'apiPlatform'>,
  ) {
    await LMSCourseIntegrationModel.save({
      ...dropUndefined(
        pick(props, ['apiKey', 'apiKeyExpiry', 'accessTokenId', 'apiCourseId']),
        true,
      ),
      courseId,
      orgIntegration,
    });
    return `Successfully linked course with ${orgIntegration.apiPlatform}`;
  }

  public async updateCourseLMSIntegration(
    integration: LMSCourseIntegrationModel,
    orgIntegration: LMSOrganizationIntegrationModel,
    props: Omit<UpsertLMSCourseParams, 'apiPlatform'>,
  ) {
    if (
      integration.orgIntegration.apiPlatform != orgIntegration.apiPlatform ||
      (props.apiCourseId && integration.apiCourseId != props.apiCourseId)
    ) {
      // If the integration changes to another platform, clear out the previously saved assignments
      // Or: if the apiCourseId changes, the information is no longer relevant - clear out old documents
      await this.clearDocuments(
        integration.courseId,
        orgIntegration.apiPlatform,
      );
    }

    await LMSCourseIntegrationModel.save({
      ...pick(integration, [
        'apiKey',
        'apiCourseId',
        'accessTokenId',
        'courseId',
        'lmsSynchronize',
      ]),
      ...dropUndefined(pick(props, ['apiKey', 'apiCourseId', 'accessTokenId'])),
      apiKeyExpiry: props.apiKeyExpiryDeleted
        ? null
        : (props.apiKeyExpiry ?? integration.apiKeyExpiry),
      orgIntegration,
    });

    return `Successfully updated link with ${integration.orgIntegration.apiPlatform}`;
  }

  async getAdapter(courseId: number): Promise<AbstractLMSAdapter | undefined> {
    const integration = await LMSCourseIntegrationModel.findOne({
      where: {
        courseId: courseId,
      },
      relations: {
        orgIntegration: true,
      },
    });
    if (integration?.orgIntegration == undefined) {
      throw new HttpException(LMSApiResponseStatus.InvalidConfiguration, 404);
    }
    return await this.integrationAdapter.getAdapter(
      integration,
      this.cacheManager,
    );
  }

  async testConnection(
    orgIntegration: LMSOrganizationIntegrationModel,
    apiCourseId: string,
    apiKey?: string,
    accessToken?: LMSAccessTokenModel,
  ): Promise<LMSApiResponseStatus> {
    const tempIntegration = new LMSCourseIntegrationModel();
    tempIntegration.apiKey = apiKey;
    tempIntegration.apiCourseId = apiCourseId;
    tempIntegration.accessToken = accessToken;
    tempIntegration.accessTokenId = accessToken.id;
    tempIntegration.orgIntegration = orgIntegration;

    const adapter = await this.integrationAdapter.getAdapter(
      tempIntegration,
      this.cacheManager,
    );
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

  public async getAPICourses(
    accessToken: LMSAccessTokenModel,
  ): Promise<LMSCourseAPIResponse[]> {
    const result = await AbstractLMSAdapter.getUserCourses(accessToken);
    if (result.status != LMSApiResponseStatus.Success) {
      throw new HttpException('', this.lmsStatusToHttpStatus(result.status));
    }
    return result.courses;
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
            (i: LMSAssignmentModel) => i.id == assignments[idx].id,
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
            (i: LMSAnnouncementModel) => i.id == announcements[idx].id,
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
      case LMSGet.Pages: {
        const { status, pages } = await adapter.getPages();
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Pages,
        );
        for (let idx = 0; idx < pages.length; idx++) {
          const found = items.find(
            (i: LMSPageModel) => i.id == pages[idx].id,
          ) as unknown as LMSPageModel;
          if (found) {
            pages[idx] = {
              id: found.id,
              title: found.title,
              body: found.body,
              url: found.url,
              frontPage: found.frontPage,
              modified: pages[idx].modified ?? found.modified,
              uploaded: found.uploaded,
              syncEnabled: found.syncEnabled,
            };
          }
        }
        retrieved = pages;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Files: {
        const { status, files } = await adapter.getFiles();
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Files,
        );
        for (let idx = 0; idx < files.length; idx++) {
          const found = items.find(
            (i: LMSFileModel) => i.id == files[idx].id,
          ) as unknown as LMSFileModel;
          if (found) {
            files[idx] = {
              id: found.id,
              name: found.name,
              url: found.url,
              contentType: found.contentType,
              size: found.size,
              modified: files[idx].modified ?? found.modified,
              uploaded: found.uploaded,
              syncEnabled: found.syncEnabled,
            };
          }
        }
        retrieved = files;
        retrievalStatus = status;
        break;
      }
      case LMSGet.Quizzes: {
        const { status, quizzes } = await adapter.getQuizzes();
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Quizzes,
        );
        for (let idx = 0; idx < quizzes.length; idx++) {
          const found = items.find(
            (i: LMSQuizModel) => i.id == quizzes[idx].id,
          ) as unknown as LMSQuizModel;
          if (found) {
            quizzes[idx] = {
              id: found.id,
              title: found.title,
              description: found.description,
              due: found.due,
              unlock: found.unlock,
              lock: found.lock,
              timeLimit: found.timeLimit,
              allowedAttempts: found.allowedAttempts,
              questions: found.questions,
              accessLevel: found.accessLevel,
              modified: quizzes[idx].modified ?? found.modified,
              uploaded: found.uploaded,
              syncEnabled: found.syncEnabled,
            };
          }
        }
        retrieved = quizzes;
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
        case LMSUpload.Pages:
          return LMSPageModel;
        case LMSUpload.Files:
          return LMSFileModel;
        case LMSUpload.Quizzes:
          return LMSQuizModel;
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

    const qb = (model as any)
      .createQueryBuilder('aModel')
      .select()
      .where('aModel.courseId = :courseId', { courseId });

    if (platforms && platforms.length > 0) {
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
    const courseIntegration = await LMSCourseIntegrationModel.findOne({
      where: { courseId: courseId },
    });

    const syncDocumentsResult: LMSSyncDocumentsResult = {
      itemsSynced: 0,
      itemsRemoved: 0,
      errors: 0,
    };

    // maybe add this later to fallback to all resources if db fetch does not work

    //   const selectedResources: LMSResourceType[] =
    // courseIntegration?.selectedResourceTypes?.length
    //   ? courseIntegration.selectedResourceTypes
    //   : [LMSResourceType.ASSIGNMENTS, LMSResourceType.ANNOUNCEMENTS];

    const selectedResources: LMSResourceType[] =
      courseIntegration.selectedResourceTypes;

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
      const resourceType = this.LMSUploadToResourceType[type as LMSUpload];

      // Check if this resource type is selected for sync
      if (!selectedResources.includes(resourceType)) {
        const { model, items } = await this.getDocumentModelAndItems(
          courseId,
          type,
        );
        if (items.length > 0) {
          const numClearedDocuments = await this.clearSpecificDocuments(
            courseId,
            items,
            model,
          );

          syncDocumentsResult.itemsRemoved += numClearedDocuments;
          syncDocumentsResult.errors += items.length - numClearedDocuments;
        }
        continue;
      }

      let result: {
        status: LMSApiResponseStatus;
        assignments?: LMSAssignment[];
        announcements?: LMSAnnouncement[];
        pages?: LMSPage[];
        files?: LMSFile[];
        quizzes?: LMSQuiz[];
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
        case LMSUpload.Pages:
          result = await adapter.getPages();
          break;
        case LMSUpload.Files:
          result = await adapter.getFiles();
          break;
        case LMSUpload.Quizzes:
          result = await adapter.getQuizzes();
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
        | LMSPage
        | LMSPageModel
        | LMSFile
        | LMSFileModel
        | LMSQuiz
        | LMSQuizModel
      )[];
      switch (type) {
        case LMSUpload.Assignments:
          items = result.assignments;
          break;
        case LMSUpload.Announcements:
          items = result.announcements;
          break;
        case LMSUpload.Pages:
          items = result.pages;
          break;
        case LMSUpload.Files:
          items = result.files;
          break;
        case LMSUpload.Quizzes:
          items = result.quizzes;
          break;
      }

      const persistedItems: (
        | LMSAnnouncementModel
        | LMSAssignmentModel
        | LMSPageModel
        | LMSFileModel
        | LMSQuizModel
      )[] = modelAndPersisted.items;

      const toRemove: (
        | LMSAnnouncementModel
        | LMSAssignmentModel
        | LMSPageModel
        | LMSFileModel
        | LMSQuizModel
      )[] = persistedItems.filter((i0) => !items.find((i1) => i1.id == i0.id));

      if (toRemove.length > 0) {
        // the code below led to inconsistent behaviour of syncDocuments when items
        // are removed from the LMS

        // const toRemoveIds = toRemove.map((i) => i.id);

        // persistedItems = persistedItems.filter((i) =>
        //   toRemoveIds.includes(i.id),
        // );

        const numClearedDocuments = await this.clearSpecificDocuments(
          courseId,
          toRemove,
          model,
        );

        syncDocumentsResult.itemsRemoved += numClearedDocuments;
        syncDocumentsResult.errors += toRemove.length - numClearedDocuments;
      }

      for (let i = 0; i < items.length; i++) {
        const found = persistedItems.find((p) => p.id == items[i].id);
        if (found) {
          // expand LMS item with peristed item's meta properties to properly
          // update persisted data when it differs from LMS data
          (items as ExtendedLMSItem[])[i] = {
            ...items[i],
            chatbotDocumentId: found.chatbotDocumentId,
            uploaded: found.uploaded,
            modified: items[i].modified ?? found.modified,
          };
        }
      }

      if (items.length == 0) continue;

      for (const item of items) {
        const response = await this.uploadDocument(
          courseId,
          item,
          type,
          adapter,
          model,
        );
        if (!!response) syncDocumentsResult.itemsSynced++;
        else syncDocumentsResult.errors++;
      }
    }
    return syncDocumentsResult;
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
    items: (
      | LMSAssignmentModel
      | LMSAnnouncementModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel
    )[],
    model:
      | typeof LMSAssignmentModel
      | typeof LMSAnnouncementModel
      | typeof LMSPageModel
      | typeof LMSFileModel
      | typeof LMSQuizModel,
  ) {
    let numClearedDocuments = 0;

    const statuses: LMSFileUploadResponse[] = [];
    for (const item of items) {
      const deleteResponse: LMSFileUploadResponse = await this.deleteDocument(
        courseId,
        item,
      );
      statuses.push(deleteResponse);

      if (deleteResponse.success) numClearedDocuments++;
    }

    const successfulIds = statuses.filter((s) => s.success).map((s) => s.id);
    await model.remove(items.filter((i) => successfulIds.includes(i.id)));

    return numClearedDocuments;
  }

  async singleDocOperation(
    courseId: number,
    item:
      | LMSAnnouncementModel
      | LMSAssignmentModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel,
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
    item:
      | LMSAnnouncementModel
      | LMSAssignmentModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel,
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
    return await this.uploadDocument(courseId, item, type, adapter, model);
  }

  private async clearDocument(
    courseId: number,
    item:
      | LMSAnnouncementModel
      | LMSAssignmentModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel,
    type: LMSUpload,
  ) {
    const model = await this.getDocumentModel(type);

    const status = await this.deleteDocument(courseId, item);

    if (status.success) {
      item.chatbotDocumentId = null;
      item.uploaded = null;
      item.syncEnabled = false;
      await (model as any).upsert(item, ['id', 'courseId']);
    }

    return status.success;
  }

  private getTypeName(type: LMSUpload) {
    switch (type) {
      case LMSUpload.Announcements:
        return 'Announcement';
      case LMSUpload.Assignments:
        return 'Assignment';
      case LMSUpload.Pages:
        return 'Page';
      case LMSUpload.Files:
        return 'File';
      case LMSUpload.Quizzes:
        return 'Quiz';
      default:
        return 'Resource';
    }
  }

  private async uploadDocument(
    courseId: number,
    item:
      | LMSAnnouncement
      | LMSAssignment
      | LMSAssignmentModel
      | LMSAnnouncementModel
      | LMSPage
      | LMSPageModel
      | LMSFile
      | LMSFileModel
      | LMSQuiz
      | LMSQuizModel,
    type: LMSUpload,
    adapter: AbstractLMSAdapter,
    model: any,
  ): Promise<string | boolean> {
    if (
      'chatbotDocumentId' in item &&
      item.chatbotDocumentId != undefined &&
      item.uploaded != undefined &&
      item.modified != undefined &&
      new Date(item.modified).getTime() <= new Date(item.uploaded).getTime()
    ) {
      return true;
    }

    let documentText = '';
    let prefix = '';
    let name = '';
    switch (type) {
      case LMSUpload.Announcements: {
        const a = item as LMSAnnouncement;
        prefix = `(Course Announcement)\nTitle: ${a.title}${!isNaN(new Date(a.posted).valueOf()) ? `\nPosted: ${new Date(a.posted).toLocaleDateString()}` : ''}${!isNaN(new Date(a.modified).valueOf()) ? `\nModified: ${new Date(a.modified).toLocaleDateString()}` : ''}`;
        name = `${a.title}`;
        documentText = `\nContent:\n${convert(a.message)}`;
        break;
      }
      case LMSUpload.Assignments: {
        const a = item as any as LMSAssignment;
        prefix = `(Course Assignment)\nName: ${a.name}${!isNaN(new Date(a.due).valueOf()) ? `\nDue Date: ${new Date(a.due).toLocaleDateString()}` : '\nDue Date: No due date'}`;
        name = `${a.name}`;
        documentText = `${a.description && `\nDescription: ${convert(a.description)}`}`;
        break;
      }
      case LMSUpload.Pages: {
        const p = item as LMSPage;
        prefix = `(Course Page)\nTitle: ${p.title}${!isNaN(new Date(p.modified).valueOf()) ? `\nModified: ${new Date(p.modified).toLocaleDateString()}` : ''}`;
        name = `${p.title}`;
        documentText = `\nContent:\n${convert(p.body)}`;
        if (p.url) {
          prefix += `\nURL: ${p.url}`;
        }
        if (p.frontPage) {
          prefix += `\nFront Page: ${p.frontPage}`;
        }
        break;
      }
      case LMSUpload.Files: {
        const f = item as LMSFile;

        if (f.url && this.isSupportedFileTypeForBuffer(f.contentType)) {
          try {
            prefix = `(Course File)\nName: ${f.name}${!isNaN(new Date(f.modified).valueOf()) ? `\nModified: ${new Date(f.modified).toLocaleDateString()}` : ''}`;
            name = `${f.name}`;

            if (f.url) {
              prefix += `\nURL: ${f.url}`;
            }

            const fileBuffer = await this.downloadFileAsBuffer(f.url, adapter);

            // mock file object
            const mockLMSFile: Express.Multer.File = {
              buffer: fileBuffer,
              originalname: f.name,
              fieldname: 'file',
              mimetype: f.contentType,
              size: f.size,
              encoding: '7bit',
              destination: '',
              filename: f.name,
              path: '',
              stream: null,
            } as Express.Multer.File;

            const computedDocLink = adapter.getDocumentLink(item.id, type);

            const result: string | false = await this.chatbotApiService
              .uploadDocument(
                mockLMSFile,
                {
                  source: computedDocLink,
                  lmsDocumentId: String(f.id),
                  parseAsPng: false,
                },
                courseId,
              )
              .then((body) => body)
              .catch((_) => false);
            if (!result) {
              return false;
            }

            return await this.afterUploadCallback(
              result,
              courseId,
              item,
              type,
              model,
              adapter,
              ChatbotResultEventName.ADD_AGGREGATE,
            );
          } catch (error) {
            console.error(
              `Failed to upload LMS file ${f.name} to chatbot:`,
              error,
            );
            return false;
          }
        } else {
          // Skip unsupported file types for now
          return false;
        }
      }
      case LMSUpload.Quizzes: {
        const q = item as LMSQuiz | LMSQuizModel;
        prefix = `(Course Quiz)\nTitle: ${q.title}${!isNaN(new Date(q.due).valueOf()) ? `\nDue Date: ${new Date(q.due).toLocaleDateString()}` : ''}${!isNaN(new Date(q.modified).valueOf()) ? `\nModified: ${new Date(q.modified).toLocaleDateString()}` : ''}`;
        name = `${q.title}`;
        documentText = this.formatQuizContent(q);
        break;
      }
      default:
        return false;
    }

    let textIsPrefix = false;
    if (!documentText && prefix) {
      documentText = prefix;
      prefix = '';
      textIsPrefix = true;
    }

    if (!documentText) {
      return false;
    }

    const computedDocLink = adapter.getDocumentLink(item.id, type);
    if (computedDocLink) {
      if (textIsPrefix) {
        documentText = `${documentText}\nPage Link: ${computedDocLink}`;
      } else {
        prefix = `${prefix ? `${prefix}\n` : ''}Page Link: ${computedDocLink}`;
      }
    }

    const docName = `${adapter.getPlatform()} ${this.getTypeName(type)}${name ? `: ${name}` : ''}`;

    const isUpdate =
      'chatbotDocumentId' in item && item.chatbotDocumentId != undefined;

    if (isUpdate) {
      const result: string | false = await this.chatbotApiService
        .updateDocument(item.chatbotDocumentId, courseId, {
          documentText,
          title: docName,
          source: computedDocLink,
          lmsDocumentId: String(item.id),
          prefix,
        })
        .then((body): string => body)
        .catch((error): false => {
          console.error(error);
          return false;
        });
      if (!result) {
        return false;
      }

      return await this.afterUploadCallback(
        result,
        courseId,
        item,
        type,
        model,
        adapter,
        ChatbotResultEventName.UPDATE_AGGREGATE,
      );
    } else {
      const result: string | false = await this.chatbotApiService
        .addDocument(courseId, {
          documentText,
          title: docName,
          source: computedDocLink,
          lmsDocumentId: String(item.id),
          prefix,
        })
        .then((body): string => {
          return body;
        })
        .catch((error): false => {
          console.error(error);
          return false;
        });
      return await this.afterUploadCallback(
        result,
        courseId,
        item,
        type,
        model,
        adapter,
        ChatbotResultEventName.ADD_AGGREGATE,
      );
    }
  }

  private async afterUploadCallback(
    result: string | false,
    courseId: number,
    item:
      | LMSAnnouncement
      | LMSAssignment
      | LMSAssignmentModel
      | LMSAnnouncementModel
      | LMSPage
      | LMSPageModel
      | LMSFile
      | LMSFileModel
      | LMSQuiz
      | LMSQuizModel,
    type: LMSUpload,
    model: typeof LMSAnnouncementModel,
    adapter: AbstractLMSAdapter,
    eventType: ChatbotResultEventName,
  ): Promise<string | false> {
    if (!result) {
      return false;
    }

    let uploadId = '';
    uploadId = await this.chatbotResultWebSocket.getUniqueId();

    this.socket.registerListener(
      {
        event: ChatbotResultEvents.POST_RESULT,
        callback: async (data: ChatbotDocumentAggregateResponse | Error) => {
          if (data instanceof Error) {
            this.socket.emit(ChatbotResultEvents.POST_RESULT, {
              uploadId,
              type: eventType,
              resultBody: {
                success: false,
                id: item?.id,
              } as LMSFileUploadResponse,
            });
            return;
          }
          const document = await this.uploadCallback(
            courseId,
            item,
            type,
            data.id,
            adapter,
            model,
          );
          this.socket.emit(ChatbotResultEvents.POST_RESULT, {
            uploadId,
            type: eventType,
            resultBody: {
              success: !!document,
              id: document?.id,
              documentId: document.chatbotDocumentId,
            } as LMSFileUploadResponse,
          });
        },
      },
      {
        event: ChatbotResultEvents.GET_RESULT,
        args: { result, type: eventType },
      },
    );

    return uploadId;
  }

  private async deleteDocument(
    courseId: number,
    item:
      | LMSAnnouncementModel
      | LMSAssignmentModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel,
  ) {
    // Already deleted in this case
    if (!item.chatbotDocumentId) {
      return {
        id: item.id,
        success: true,
      };
    }
    return await this.chatbotApiService
      .deleteDocument(item.chatbotDocumentId, courseId)
      .then(
        (): LMSFileUploadResponse => ({
          id: item.id,
          success: true,
        }),
      )
      .catch((error): LMSFileUploadResponse => {
        console.error(error);
        // 404 = Already deleted/didn't exist
        if (error.getStatus() == 404) {
          return {
            id: item.id,
            success: true,
          } as LMSFileUploadResponse;
        }
        return {
          id: item.id,
          success: false,
        };
      });
  }

  private createCallbacks = {
    [LMSUpload.Announcements]: async (
      item: LMSAnnouncement | LMSAnnouncementModel,
      model: typeof LMSAnnouncementModel,
      adapter: AbstractLMSAdapter,
      courseId: number,
      chatbotDocumentId?: string,
    ) => {
      const ann = item as LMSAnnouncement;
      return (await model
        .create({
          id: ann.id,
          title: ann.title,
          message: ann.message ?? '',
          posted: ann.posted,
          chatbotDocumentId,
          uploaded: new Date(),
          syncEnabled: true,
          modified:
            ann.modified != undefined ? new Date(ann.modified) : new Date(),
          courseId: courseId,
          lmsSource: adapter.getPlatform(),
        })
        .save()) as LMSAnnouncementModel;
    },
    [LMSUpload.Assignments]: async (
      item: LMSAssignment | LMSAssignmentModel,
      model: typeof LMSAssignmentModel,
      adapter: AbstractLMSAdapter,
      courseId: number,
      chatbotDocumentId?: string,
    ) => {
      const asg = item as LMSAssignment;
      return (await model
        .create({
          id: asg.id,
          name: asg.name,
          description: asg.description ?? '',
          due: asg.due,
          chatbotDocumentId,
          uploaded: new Date(),
          courseId: courseId,
          syncEnabled: true,
          modified:
            asg.modified != undefined ? new Date(asg.modified) : new Date(),
          lmsSource: adapter.getPlatform(),
        })
        .save()) as LMSAssignmentModel;
    },
    [LMSUpload.Pages]: async (
      item: LMSPage | LMSPageModel,
      model: typeof LMSPageModel,
      adapter: AbstractLMSAdapter,
      courseId: number,
      chatbotDocumentId?: string,
    ) => {
      const page = item as LMSPage;
      return (await model
        .create({
          id: page.id,
          title: page.title,
          body: page.body,
          url: page.url,
          frontPage: page.frontPage,
          chatbotDocumentId: chatbotDocumentId,
          uploaded: new Date(),
          courseId: courseId,
          syncEnabled: true,
          modified:
            page.modified != undefined ? new Date(page.modified) : new Date(),
          lmsSource: adapter.getPlatform(),
        })
        .save()) as LMSPageModel;
    },
    [LMSUpload.Files]: async (
      item: LMSFile | LMSFileModel,
      model: typeof LMSFileModel,
      adapter: AbstractLMSAdapter,
      courseId: number,
      chatbotDocumentId?: string,
    ) => {
      const file = item as LMSFile;
      return (await model
        .create({
          id: file.id,
          name: file.name,
          url: file.url,
          contentType: file.contentType,
          size: file.size,
          chatbotDocumentId: chatbotDocumentId,
          uploaded: new Date(),
          courseId: courseId,
          syncEnabled: true,
          modified:
            file.modified != undefined ? new Date(file.modified) : new Date(),
          lmsSource: adapter.getPlatform(),
        })
        .save()) as LMSFileModel;
    },
    [LMSUpload.Quizzes]: async (
      item: LMSQuiz | LMSQuizModel,
      model: typeof LMSQuizModel,
      adapter: AbstractLMSAdapter,
      courseId: number,
      chatbotDocumentId?: string,
    ) => {
      const quiz = item as LMSQuiz;
      return (await model
        .create({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          due: quiz.due,
          unlock: quiz.unlock,
          lock: quiz.lock,
          timeLimit: quiz.timeLimit,
          allowedAttempts: quiz.allowedAttempts,
          questions: quiz.questions,
          accessLevel: LMSQuizAccessLevel.LOGISTICS_ONLY, // Default access level
          chatbotDocumentId: chatbotDocumentId,
          uploaded: new Date(),
          syncEnabled: true,
          courseId: courseId,
          modified:
            quiz.modified != undefined ? new Date(quiz.modified) : new Date(),
          lmsSource: adapter.getPlatform(),
        })
        .save()) as LMSQuizModel;
    },
  };

  private async uploadCallback(
    courseId: number,
    item:
      | LMSAnnouncement
      | LMSAssignment
      | LMSAssignmentModel
      | LMSAnnouncementModel
      | LMSPage
      | LMSPageModel
      | LMSFile
      | LMSFileModel
      | LMSQuiz
      | LMSQuizModel,
    type: LMSUpload,
    chatbotDocumentId: string,
    adapter: AbstractLMSAdapter,
    model: any,
  ): Promise<any> {
    chatbotDocumentId ??=
      'chatbotDocumentId' in item && item.chatbotDocumentId != undefined
        ? item.chatbotDocumentId
        : chatbotDocumentId;

    if (this.createCallbacks[type]) {
      return await this.createCallbacks[type](
        item as any,
        model as any,
        adapter,
        courseId,
        chatbotDocumentId,
      );
    }
  }

  getPartialOrgLmsIntegration(
    lmsIntegration: LMSOrganizationIntegrationModel,
  ): LMSOrganizationIntegrationPartial {
    return {
      organizationId: lmsIntegration.organizationId,
      apiPlatform: lmsIntegration.apiPlatform,
      rootUrl: lmsIntegration.rootUrl,
      clientId: lmsIntegration.clientId,
      hasClientSecret: lmsIntegration.clientSecret != undefined,
      secure: lmsIntegration.secure,
      courseIntegrations:
        lmsIntegration.courseIntegrations?.map((cint) =>
          this.getPartialCourseLmsIntegration(cint, lmsIntegration.apiPlatform),
        ) ?? [],
    } satisfies LMSOrganizationIntegrationPartial;
  }

  getPartialCourseLmsIntegration(
    lmsIntegration: LMSCourseIntegrationModel,
    platform?: LMSIntegrationPlatform,
  ): LMSCourseIntegrationPartial {
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
      hasApiKey: lmsIntegration.apiKey != undefined,
      accessTokenId: lmsIntegration.accessTokenId,
      lmsSynchronize: lmsIntegration.lmsSynchronize,
      isExpired:
        lmsIntegration.apiKeyExpiry != undefined &&
        new Date(lmsIntegration.apiKeyExpiry).getTime() < new Date().getTime(),
      selectedResourceTypes: lmsIntegration.selectedResourceTypes,
    } satisfies LMSCourseIntegrationPartial;
  }

  private isSupportedFileTypeForBuffer(contentType: string): boolean {
    // See the enum source in common/index.ts
    const supportedTypes = Object.values(SupportedLMSFileTypes) as string[];
    // [
    //   // have to test with more file types, but these ones should be the most prevalent
    //   'application/pdf', // .pdf files
    //   'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx files
    // ];
    return supportedTypes.includes(contentType);
  }

  private async downloadFileAsBuffer(
    url: string,
    adapter: AbstractLMSAdapter,
  ): Promise<Buffer> {
    // Download the file as a buffer using the same approach as the chatbot service
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${adapter['integration'].apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to download file: ${response.status} ${response.statusText}`,
      );
    }

    // Use the same buffer conversion approach as the chatbot service
    return await this.bodyToBuffer(response.body);
  }

  // same as the one in the chatbot repository
  private async bodyToBuffer(body: any): Promise<Buffer> {
    const stream = body as ReadableStream;
    const reader = stream.getReader();
    const chunks: any[] = [];
    let last: ReadableStreamReadResult<any> = {
      value: undefined,
      done: false,
    };
    while (!last.done) {
      last = await reader.read();
      if (last.value) {
        chunks.push(last.value);
      }
    }
    return Buffer.concat(chunks);
  }

  async updateQuizAccessLevel(
    courseId: number,
    quizId: number,
    accessLevel: LMSQuizAccessLevel,
  ): Promise<boolean> {
    try {
      const quiz = await LMSQuizModel.findOne({
        where: { id: quizId, courseId },
      });

      if (!quiz) {
        throw new Error('Quiz not found');
      }

      quiz.accessLevel = accessLevel;
      await quiz.save();

      if (quiz.syncEnabled && quiz.chatbotDocumentId) {
        console.log(
          `Updating chatbot document for quiz ${quizId} with new access level: ${accessLevel}`,
        );

        await this.singleDocOperation(
          courseId,
          quiz,
          LMSUpload.Quizzes,
          'Clear',
        );

        await this.singleDocOperation(
          courseId,
          quiz,
          LMSUpload.Quizzes,
          'Sync',
        );

        console.log(`Successfully updated chatbot document for quiz ${quizId}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to update quiz access level:', error);
      return false;
    }
  }

  private formatQuizContent(quiz: LMSQuiz | LMSQuizModel): string {
    let content = '';

    if (quiz.description) {
      content += `\nDescription: ${convert(quiz.description)}`;
    }

    if (quiz.unlock) {
      content += `\nAvailable from: ${new Date(quiz.unlock).toLocaleDateString()}`;
    }

    if (quiz.lock) {
      content += `\nAvailable until: ${new Date(quiz.lock).toLocaleDateString()}`;
    }

    if (quiz.timeLimit) {
      content += `\nTime Limit: ${quiz.timeLimit} minutes`;
    }

    if (quiz.allowedAttempts) {
      content += `\nAllowed Attempts: ${quiz.allowedAttempts}`;
    }

    // Get access level (default to LOGISTICS_ONLY if not specified)
    const accessLevel =
      'accessLevel' in quiz
        ? quiz.accessLevel
        : LMSQuizAccessLevel.LOGISTICS_ONLY;

    if (accessLevel === LMSQuizAccessLevel.LOGISTICS_ONLY) {
      return content;
    }

    // Add questions for LOGISTICS_AND_QUESTIONS level and higher
    if (quiz.questions && quiz.questions.length > 0) {
      content += '\n\nQuestions:';
      quiz.questions.forEach((q: any, i: number) => {
        content += `\n${i + 1}. ${convert(q.question_text) || q.question_name || 'Question'}`;

        if (
          accessLevel ===
          LMSQuizAccessLevel.LOGISTICS_QUESTIONS_GENERAL_COMMENTS
        ) {
          if (q.neutral_comments_html) {
            content += `\n   General comments: ${convert(q.neutral_comments_html)}`;
          } else if (q.neutral_comments) {
            content += `\n   General comments: ${q.neutral_comments}`;
          }
        }

        if (
          accessLevel === LMSQuizAccessLevel.FULL_ACCESS &&
          q.answers?.length > 0
        ) {
          content += '\n   Answer options:';
          q.answers.forEach((a: any) => {
            const marker = a.weight > 0 ? ' [CORRECT]' : '';
            content += `\n   - ${a.text}${marker}`;

            if (a.comments_html) {
              content += `\n     Answer feedback: ${convert(a.comments_html)}`;
            } else if (a.comments) {
              content += `\n     Answer feedback: ${a.comments}`;
            }
          });

          if (q.correct_comments_html) {
            content += `\n   Correct answer feedback: ${convert(q.correct_comments_html)}`;
          } else if (q.correct_comments) {
            content += `\n   Correct answer feedback: ${q.correct_comments}`;
          }

          if (q.incorrect_comments_html) {
            content += `\n   Incorrect answer feedback: ${convert(q.incorrect_comments_html)}`;
          } else if (q.incorrect_comments) {
            content += `\n   Incorrect answer feedback: ${q.incorrect_comments}`;
          }

          if (q.neutral_comments_html) {
            content += `\n   General comments: ${convert(q.neutral_comments_html)}`;
          } else if (q.neutral_comments) {
            content += `\n   General comments: ${q.neutral_comments}`;
          }
        }
      });
    }

    return content;
  }

  // Public method for generating preview content
  formatQuizContentPreview(quiz: any): string {
    return this.formatQuizContent(quiz);
  }
}
