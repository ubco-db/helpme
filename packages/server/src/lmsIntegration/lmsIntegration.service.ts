import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import {
  CoursePartial,
  ERROR_MESSAGES,
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseIntegrationPartial,
  LMSFile,
  LMSFileUploadResponse,
  LMSIntegrationPlatform,
  LMSOrganizationIntegrationPartial,
  LMSPage,
  LMSQuiz,
  LMSQuizAccessLevel,
  LMSResourceType,
  SupportedLMSFileTypes,
  LMSSyncDocumentsResult,
} from '@koh/common';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { LMSPageModel } from './lmsPage.entity';
import { LMSFileModel } from './lmsFile.entity';
import { LMSQuizModel } from './lmsQuiz.entity';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { UserModel } from '../profile/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 } from 'uuid';
import * as Sentry from '@sentry/browser';
import { ConfigService } from '@nestjs/config';
import { convert } from 'html-to-text';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { Cache } from 'cache-manager';

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
  constructor(
    @Inject(LMSIntegrationAdapter)
    private integrationAdapter: LMSIntegrationAdapter,
    @Inject(ConfigService)
    private configService: ConfigService,
    @Inject(ChatbotApiService)
    private chatbotApiService: ChatbotApiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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
    apiKey: string,
    apiCourseId: string,
  ): Promise<LMSApiResponseStatus> {
    const tempIntegration = new LMSCourseIntegrationModel();
    tempIntegration.apiKey = apiKey;
    tempIntegration.apiCourseId = apiCourseId;
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
      case LMSGet.Pages: {
        const { status, pages } = await adapter.getPages();
        const { items } = await this.getDocumentModelAndItems(
          courseId,
          LMSUpload.Pages,
        );
        for (let idx = 0; idx < pages.length; idx++) {
          const found = items.find(
            (i) => i.id == pages[idx].id,
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
              isModuleLinked: found.isModuleLinked,
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
            (i) => i.id == files[idx].id,
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
            (i) => i.id == quizzes[idx].id,
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

    const adapterForCache = await this.getAdapter(courseId);
    if (adapterForCache) {
      await adapterForCache.clearPageCache();
    }

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
          if (courseIntegration.moduleLinkedPagesOnly) {
            const allPages = items as LMSPage[];
            const moduleLinkedPages = allPages.filter(
              (page) => page.isModuleLinked === true,
            );
            if (moduleLinkedPages.length === 0 && allPages.length > 0) {
              console.warn(
                `Module-linked pages only setting is enabled for course ${courseId}, ` +
                  `but no pages were detected as module-linked out of ${allPages.length} total pages. ` +
                  `This might indicate that no pages are linked in course modules, or there's a ` +
                  `configuration issue. Proceeding with filter - this will remove all page content from chatbot.`,
              );
            }

            items = moduleLinkedPages;
          }
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

      let toRemove: (
        | LMSAnnouncementModel
        | LMSAssignmentModel
        | LMSPageModel
        | LMSFileModel
        | LMSQuizModel
      )[] = [];

      if (type === LMSUpload.Pages && courseIntegration.moduleLinkedPagesOnly) {
        const allPagesFromLMS = result.pages as LMSPage[];
        const persistedPages = persistedItems as LMSPageModel[];

        toRemove = persistedPages.filter((persistedPage) => {
          const currentLMSPage = allPagesFromLMS.find(
            (p) => p.id === persistedPage.id,
          );
          return !currentLMSPage || !currentLMSPage.isModuleLinked;
        });
      } else {
        toRemove = persistedItems.filter(
          (i0) => !items.find((i1) => i1.id == i0.id),
        );
      }

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
        const uploadDocumentResponse = await this.uploadDocument(
          courseId,
          item,
          token,
          type,
          adapter,
        );
        statuses.push(uploadDocumentResponse);

        if (uploadDocumentResponse.success) syncDocumentsResult.itemsSynced++;
        else syncDocumentsResult.errors++;
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
                message: ann.message ?? '',
                posted: ann.posted,
                chatbotDocumentId,
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
                chatbotDocumentId,
                uploaded: new Date(),
                courseId: courseId,
                modified:
                  asg.modified != undefined
                    ? new Date(asg.modified)
                    : new Date(),
                lmsSource: adapter.getPlatform(),
              }) as LMSAssignmentModel;
            case LMSUpload.Pages:
              const page = i as LMSPage;
              return (model as typeof LMSPageModel).create({
                id: page.id,
                title: page.title,
                body: page.body,
                url: page.url,
                frontPage: page.frontPage,
                chatbotDocumentId: chatbotDocumentId,
                uploaded: new Date(),
                courseId: courseId,
                modified:
                  page.modified != undefined
                    ? new Date(page.modified)
                    : new Date(),
                lmsSource: adapter.getPlatform(),
              }) as LMSPageModel;
            case LMSUpload.Files:
              const file = i as LMSFile;
              return (model as typeof LMSFileModel).create({
                id: file.id,
                name: file.name,
                url: file.url,
                contentType: file.contentType,
                size: file.size,
                chatbotDocumentId: chatbotDocumentId,
                uploaded: new Date(),
                courseId: courseId,
                modified:
                  file.modified != undefined
                    ? new Date(file.modified)
                    : new Date(),
                lmsSource: adapter.getPlatform(),
              }) as LMSFileModel;
            case LMSUpload.Quizzes:
              const quiz = i as LMSQuiz;
              return (model as typeof LMSQuizModel).create({
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
                courseId: courseId,
                modified:
                  quiz.modified != undefined
                    ? new Date(quiz.modified)
                    : new Date(),
                lmsSource: adapter.getPlatform(),
              }) as LMSQuizModel;
            default:
              return undefined;
          }
        })
        .filter((e) => e != undefined) as
        | LMSAssignmentModel[]
        | LMSAnnouncementModel[]
        | LMSPageModel[]
        | LMSFileModel[]
        | LMSQuizModel[];

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
        case LMSUpload.Pages:
          await (model as typeof LMSPageModel).save(entities as LMSPageModel[]);
          break;
        case LMSUpload.Files:
          await (model as typeof LMSFileModel).save(entities as LMSFileModel[]);
          break;
        case LMSUpload.Quizzes:
          await (model as typeof LMSQuizModel).save(entities as LMSQuizModel[]);
          break;
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
      const deleteResponse: LMSFileUploadResponse = await this.deleteDocument(
        courseId,
        item,
        token,
      );
      statuses.push(deleteResponse);

      if (deleteResponse.success) numClearedDocuments++;
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

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
      await (model as any).upsert(item, ['id', 'courseId']);
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

    return status.success;
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
      await (model as any).upsert(item, ['id', 'courseId']);
    }

    await ChatTokenModel.remove(token);
    await UserModel.remove(tempUser);

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
    token: ChatTokenModel,
    type: LMSUpload,
    adapter: AbstractLMSAdapter,
  ): Promise<LMSFileUploadResponse> {
    if (
      'chatbotDocumentId' in item &&
      item.chatbotDocumentId != undefined &&
      item.uploaded != undefined &&
      item.modified != undefined &&
      new Date(item.modified).getTime() <= new Date(item.uploaded).getTime()
    ) {
      return {
        id: item.id,
        success: true,
        documentId: item.chatbotDocumentId,
      };
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

            const isUpdate =
              'chatbotDocumentId' in f && f.chatbotDocumentId != undefined;

            if (isUpdate) {
              try {
                await this.chatbotApiService.deleteDocument(
                  f.chatbotDocumentId as string,
                  courseId,
                  token.token,
                );
              } catch (error) {
                console.warn(
                  `Failed to delete old LMS file document ${f.chatbotDocumentId}, proceeding with new upload:`,
                  error,
                );
              }
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
            const sourceWithPrefix = `${prefix}${computedDocLink ? `\nPage Link: ${computedDocLink}` : ''}`;

            const uploadResult =
              await this.chatbotApiService.uploadLMSFileFromBuffer(
                mockLMSFile,
                courseId,
                token.token,
                {
                  source: sourceWithPrefix,
                  metadata: {
                    type: 'inserted_lms_document',
                    apiDocId: f.id,
                    platform: adapter.getPlatform(),
                    source: computedDocLink,
                  },
                  parseAsPng: false,
                },
              );

            return {
              id: item.id,
              success: true,
              documentId: uploadResult.docId,
            } as LMSFileUploadResponse;
          } catch (error) {
            console.error(
              `Failed to upload LMS file ${f.name} to chatbot:`,
              error,
            );
            return {
              id: item.id,
              success: false,
            } as LMSFileUploadResponse;
          }
        } else {
          // Skip unsupported file types for now
          return {
            id: item.id,
            success: false,
          } as LMSFileUploadResponse;
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
        return {
          id: item.id,
          success: false,
        } as LMSFileUploadResponse;
    }

    let textIsPrefix = false;
    if (!documentText && prefix) {
      documentText = prefix;
      prefix = '';
      textIsPrefix = true;
    }

    if (!documentText) {
      return {
        id: item.id,
        success: false,
      };
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
    const metadata: any = {
      type: 'inserted_lms_document',
      apiDocId: item.id,
    };

    const isUpdate =
      'chatbotDocumentId' in item && item.chatbotDocumentId != undefined;

    if (isUpdate) {
      return await this.chatbotApiService
        .updateDocument(item.chatbotDocumentId, courseId, token.token, {
          documentText,
          metadata,
          prefix,
        })
        .then((): LMSFileUploadResponse => {
          return {
            id: item.id,
            success: true,
            documentId: item.chatbotDocumentId,
          };
        })
        .catch((error): LMSFileUploadResponse => {
          console.error(error);
          return {
            id: item.id,
            success: false,
          } as LMSFileUploadResponse;
        });
    } else {
      return await this.chatbotApiService
        .addDocument(courseId, token.token, {
          documentText,
          metadata,
          name: docName,
          prefix,
          source: computedDocLink,
        })
        .then((body): LMSFileUploadResponse => {
          return {
            id: item.id,
            success: true,
            documentId: body.id,
          };
        })
        .catch((error): LMSFileUploadResponse => {
          console.error(error);
          return {
            id: item.id,
            success: false,
          } as LMSFileUploadResponse;
        });
    }
  }

  private async deleteDocument(
    courseId: number,
    item:
      | LMSAnnouncementModel
      | LMSAssignmentModel
      | LMSPageModel
      | LMSFileModel
      | LMSQuizModel,
    token: ChatTokenModel,
  ) {
    // Already deleted in this case
    if (!item.chatbotDocumentId) {
      return {
        id: item.id,
        success: true,
      };
    }
    return await this.chatbotApiService
      .deleteDocument(item.chatbotDocumentId, courseId, token.token)
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
      selectedResourceTypes: lmsIntegration.selectedResourceTypes,
      moduleLinkedPagesOnly: lmsIntegration.moduleLinkedPagesOnly,
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
