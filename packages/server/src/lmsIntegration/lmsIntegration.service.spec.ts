import { DataSource } from 'typeorm';
import {
  LMSGet,
  LMSIntegrationService,
  LMSUpload,
} from './lmsIntegration.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  TestChatbotConnectionOptions,
  TestConfigModule,
  TestTypeOrmModule,
} from '../../test/util/testUtils';
import {
  AbstractLMSAdapter,
  LMSIntegrationAdapter,
} from './lmsIntegration.adapter';
import {
  CourseFactory,
  initFactoriesFromService,
  LMSAccessTokenFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  UserFactory,
} from '../../test/util/factories';
import {
  LMSAnnouncement,
  LMSApiResponseStatus,
  LMSAssignment,
  LMSCourseAPIResponse,
  LMSIntegrationPlatform,
  LMSPostResponseBody,
} from '@koh/common';
import { LMSCourseIntegrationModel } from './lmsCourseIntegration.entity';
import { HttpStatus } from '@nestjs/common';
import { LMSOrganizationIntegrationModel } from './lmsOrgIntegration.entity';
import { CourseModel } from '../course/course.entity';
import { OrganizationModel } from '../organization/organization.entity';
import { LMSAnnouncementModel } from './lmsAnnouncement.entity';
import { LMSAssignmentModel } from './lmsAssignment.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { ChatbotApiService } from '../chatbot/chatbot-api.service';
import { LMSAccessTokenModel } from './lms-access-token.entity';
import { UserModel } from '../profile/user.entity';
import * as crypto from 'crypto';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
};

/*
Note:
  The majority of methods in the LMSIntegrationService require external API calls.
  The only function that can be formally tested is the getAdapter() function.
*/
describe('LMSIntegrationService', () => {
  let service: LMSIntegrationService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        ChatbotModule.forRoot(TestChatbotConnectionOptions),
      ],
      providers: [
        LMSIntegrationService,
        LMSIntegrationAdapter,
        ChatbotApiService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<LMSIntegrationService>(LMSIntegrationService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('resynchronizeCourseIntegrations', () => {
    it('should call to sync documents of any courses with sync enabled', async () => {
      const org = await OrganizationFactory.create();
      const orgIntegration = await lmsOrgIntFactory.create({
        organization: org,
        rootUrl: 'example.ubc.ca',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });
      const courses = [
        await CourseFactory.create(),
        await CourseFactory.create(),
        await CourseFactory.create(),
      ];
      for (const course of courses) {
        course.organizationCourse = await OrganizationCourseFactory.create({
          organization: org,
          course: course,
        });
        course.lmsIntegration = await lmsCourseIntFactory.create({
          course: course,
          apiCourseId: 'abc',
          apiKey: 'def',
          lmsSynchronize: course.id != 2,
          orgIntegration,
        });
      }

      const findSpy = jest.spyOn(LMSCourseIntegrationModel, 'find');
      const syncDocSpy = jest.spyOn(service, 'syncDocuments');
      syncDocSpy.mockImplementation(async () => undefined);
      await service.resynchronizeCourseIntegrations();

      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(findSpy).toHaveBeenCalledWith({
        where: { lmsSynchronize: true },
      });

      const nCourses = courses.filter(
        (c) => c.lmsIntegration.lmsSynchronize,
      ).length;
      expect(service.syncDocuments).toHaveBeenCalledTimes(nCourses);
      let i = 1;
      for (const course of courses.filter(
        (c) => c.lmsIntegration.lmsSynchronize,
      )) {
        expect(service.syncDocuments).toHaveBeenNthCalledWith(i, course.id);
        ++i;
      }
      syncDocSpy.mockRestore();
      findSpy.mockRestore();
    });
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
      expect(adapterResult.isImplemented()).toBeTruthy();
    });
  });

  describe('lmsStatusToHttpStatus', () => {
    it.each([
      {
        status: LMSApiResponseStatus.InvalidKey,
        httpStatus: HttpStatus.UNAUTHORIZED,
      },
      {
        status: LMSApiResponseStatus.InvalidPlatform,
        httpStatus: HttpStatus.NOT_FOUND,
      },
      { status: LMSApiResponseStatus.None, httpStatus: HttpStatus.BAD_REQUEST },
      { status: LMSApiResponseStatus.None, httpStatus: HttpStatus.BAD_REQUEST },
      {
        status: LMSApiResponseStatus.Error,
        httpStatus: HttpStatus.BAD_REQUEST,
      },
      {
        status: LMSApiResponseStatus.InvalidCourseId,
        httpStatus: HttpStatus.BAD_REQUEST,
      },
      {
        status: LMSApiResponseStatus.InvalidConfiguration,
        httpStatus: HttpStatus.BAD_REQUEST,
      },
    ])('should return the correct HTTP status', ({ status, httpStatus }) => {
      expect(service.lmsStatusToHttpStatus(status)).toBe(httpStatus);
    });
  });

  describe('upsertOrganizationLMSIntegration', () => {
    let org: OrganizationModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
    });

    it('should behave as create if integration is found', async () => {
      const response = await service.upsertOrganizationLMSIntegration(org.id, {
        rootUrl: 'www.example.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });

      const created = await LMSOrganizationIntegrationModel.findOne({
        where: {
          organizationId: org.id,
          apiPlatform: LMSIntegrationPlatform.Canvas,
        },
      });

      expect(created).toBeTruthy();
      expect(response.includes('created')).toBeTruthy();
    });

    it('should behave as update if integration is found', async () => {
      const org = await OrganizationFactory.create();
      await LMSOrganizationIntegrationModel.create({
        organizationId: org.id,
        rootUrl: 'www.example.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      }).save();

      const response = await service.upsertOrganizationLMSIntegration(org.id, {
        rootUrl: 'www.example2.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      });

      const updated = await LMSOrganizationIntegrationModel.findOne({
        where: {
          organizationId: org.id,
          apiPlatform: LMSIntegrationPlatform.Canvas,
        },
      });

      expect(updated.rootUrl).toEqual('www.example2.com');
      expect(response.includes('updated')).toBeTruthy();
    });
  });

  describe('createAccessToken', () => {
    let user: UserModel;

    beforeEach(async () => {
      user = await UserFactory.create({});
    });

    it('should fail if integration has no defined secret', async () => {
      const orgInt = await lmsOrgIntFactory.create();
      const token = {
        access_token: crypto.randomBytes(16).toString('hex'),
        token_type: 'Bearer',
        user: {
          id: 0,
          name: 'Heinz Doofenschmirtz',
        },
        refresh_token: crypto.randomBytes(16).toString('hex'),
        expires_in: 0,
      } satisfies LMSPostResponseBody;

      await expect(
        service.createAccessToken(user, orgInt, token),
      ).rejects.toThrow(
        new Error('Cannot use encryption without a defined secret!'),
      );
    });

    it('should encrypt data in a way that is retrievable', async () => {
      const orgInt = await lmsOrgIntFactory.create({
        clientSecret: crypto.randomBytes(32).toString('hex'),
      });

      const token = {
        access_token: crypto.randomBytes(16).toString('hex'),
        token_type: 'Bearer',
        user: {
          id: 0,
          name: 'Heinz Doofenschmirtz',
        },
        refresh_token: crypto.randomBytes(16).toString('hex'),
        expires_in: 0,
      } satisfies LMSPostResponseBody;

      const accessToken = await service.createAccessToken(user, orgInt, token);

      expect(accessToken.iv).toBeDefined();
      expect(accessToken.data).toBeDefined();
      const expectToken = {
        ...token,
        userId: 0,
      };
      delete expectToken.user;
      expect(await accessToken.getToken()).toEqual(expectToken);
    });
  });

  describe('destroyAccessToken', () => {
    it.each([
      ['not', "doesn't", false],
      ['', '', true],
    ])('should destroy access token if succeeds', async (_m0, _m1, bool) => {
      const spy = jest.spyOn(AbstractLMSAdapter, 'logoutAuth');
      spy.mockResolvedValue(bool);
      const token = await LMSAccessTokenFactory.create();
      expect(await service.destroyAccessToken(token)).toBe(bool);
      const find = await LMSAccessTokenModel.findOne({
        where: { id: token.id },
      });

      if (bool) {
        expect(find).toBeNull();
      } else {
        expect(find).toBeDefined();
      }
    });
  });

  describe('createCourseLMSIntegration', () => {
    let org: OrganizationModel;
    let orgInt: LMSOrganizationIntegrationModel;
    let course: CourseModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
      orgInt = await LMSOrganizationIntegrationModel.create({
        organizationId: org.id,
        rootUrl: 'www.example.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      }).save();
      course = await CourseFactory.create();
    });

    it('should create a new course integration without an expiry', async () => {
      await service.createCourseLMSIntegration(orgInt, course.id, {
        apiCourseId: '1',
        apiKey: 'abc',
      });

      const check = await LMSCourseIntegrationModel.findOne({
        where: {
          courseId: course.id,
        },
      });
      expect(check).toBeTruthy();
      expect(check.apiKey).toBe('abc');
      expect(check.apiKeyExpiry).toBeNull();
      expect(check.accessTokenId).toBeNull();
    });

    it('should create a new course integration with an expiry', async () => {
      const token = await LMSAccessTokenFactory.create({
        organizationIntegration: orgInt,
      });
      await service.createCourseLMSIntegration(orgInt, course.id, {
        apiCourseId: '1',
        apiKey: 'abc',
        apiKeyExpiry: new Date(),
        accessTokenId: token.id,
      });
      const check = await LMSCourseIntegrationModel.findOne({
        where: {
          courseId: course.id,
        },
      });
      expect(check).toBeTruthy();
      expect(check.apiKey).toBe('abc');
      expect(check.apiKeyExpiry).toBeTruthy();
      expect(check.accessTokenId).toBe(token.id);
    });
  });

  describe('updateCourseLMSIntegration', () => {
    let org: OrganizationModel;
    let orgInt: LMSOrganizationIntegrationModel;
    let course: CourseModel;
    let courseInt: LMSCourseIntegrationModel;
    let token: LMSAccessTokenModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
      orgInt = await LMSOrganizationIntegrationModel.create({
        organizationId: org.id,
        rootUrl: 'www.example.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      }).save();

      course = await CourseFactory.create();
      courseInt = await LMSCourseIntegrationModel.create({
        orgIntegration: orgInt,
        course: course,
        apiCourseId: '0',
        apiKey: 'oldkey',
        apiKeyExpiry: new Date(),
      }).save();

      token = await LMSAccessTokenFactory.create({
        organizationIntegration: orgInt,
      });
    });

    it('should update parameters', async () => {
      const now = new Date();

      await service.updateCourseLMSIntegration(courseInt, orgInt, {
        apiCourseId: '1',
        apiKey: 'key',
        apiKeyExpiry: now,
        apiKeyExpiryDeleted: false,
        accessTokenId: token.id,
      });

      const updated = await LMSCourseIntegrationModel.findOne({
        where: {
          courseId: course.id,
        },
      });

      expect(updated).toBeTruthy();
      expect(updated.apiCourseId).toBe('1');
      expect(updated.apiKey).toBe('key');
      expect(updated.apiKeyExpiry).toEqual(now);
      expect(updated.accessTokenId).toBe(token.id);
    });

    it('should delete expiry when specified', async () => {
      await service.updateCourseLMSIntegration(courseInt, orgInt, {
        apiCourseId: '1',
        apiKey: 'key',
        apiKeyExpiryDeleted: true,
      });

      const updated = await LMSCourseIntegrationModel.findOne({
        where: {
          courseId: course.id,
        },
      });

      expect(updated).toBeTruthy();
      expect(updated.apiCourseId).toBe('1');
      expect(updated.apiKey).toBe('key');
      expect(updated.apiKeyExpiry).toBeNull();
    });
  });

  describe('getItems', () => {
    let getAdapter: any;
    let mockAdapter: any;

    beforeEach(async () => {
      getAdapter = service.getAdapter;
      mockAdapter = {
        getPlatform(): LMSIntegrationPlatform | null {
          return null;
        },

        isImplemented(): boolean {
          return false;
        },

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async Get(_url: string): Promise<{
          status: LMSApiResponseStatus;
          data?: any;
          nextLink?: string;
        }> {
          return null;
        },

        async getCourse(): Promise<{
          status: LMSApiResponseStatus;
          course: LMSCourseAPIResponse;
        }> {
          return null;
        },

        async getStudents(): Promise<{
          status: LMSApiResponseStatus;
          students: string[];
        }> {
          return null;
        },

        async getAnnouncements(): Promise<{
          status: LMSApiResponseStatus;
          announcements: LMSAnnouncement[];
        }> {
          return null;
        },

        async getAssignments(): Promise<{
          status: LMSApiResponseStatus;
          assignments: LMSAssignment[];
        }> {
          return null;
        },

        getDocumentLink(documentId: number, documentType: LMSUpload): string {
          switch (documentType) {
            default:
              return '';
          }
        },
      } as AbstractLMSAdapter;
      service.getAdapter = jest.fn(async () => mockAdapter);
    });

    afterEach(async () => {
      service.getAdapter = getAdapter;
      jest.restoreAllMocks();
    });

    it('should return list of students as string array if type is Students', async () => {
      const students = ['Student1', 'Student2', 'Student3'];
      mockAdapter.getStudents = jest.fn(async () => {
        return {
          status: LMSApiResponseStatus.Success,
          students,
        };
      });

      const resp = await service.getItems(0, LMSGet.Students);
      expect(resp).toEqual(students);
    });

    it('should return list of assignments if type is Assignments', async () => {
      const assignments = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockAdapter.getAssignments = jest.fn(async () => {
        return {
          status: LMSApiResponseStatus.Success,
          assignments,
        };
      });

      const spy = jest.spyOn(service, 'getDocumentModelAndItems');
      const resp = await service.getItems(0, LMSGet.Assignments);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(resp).toEqual(assignments);
    });

    it('should return list of announcements if type is Announcements', async () => {
      const announcements = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockAdapter.getAnnouncements = jest.fn(async () => {
        return {
          status: LMSApiResponseStatus.Success,
          announcements,
        };
      });

      const spy = jest.spyOn(service, 'getDocumentModelAndItems');
      const resp = await service.getItems(0, LMSGet.Announcements);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(resp).toEqual(announcements);
    });

    it('should return course object if type is Course', async () => {
      const course = { id: 1 };
      mockAdapter.getCourse = jest.fn(async () => {
        return {
          status: LMSApiResponseStatus.Success,
          course,
        };
      });

      const resp = await service.getItems(0, LMSGet.Course);
      expect(resp).toEqual(course);
    });
  });

  describe('getDocumentModel', () => {
    it('should return LMSAnnouncementModel if type is Announcements', async () => {
      const res = await service.getDocumentModel(LMSUpload.Announcements);
      expect(res).toBe(LMSAnnouncementModel);
    });

    it('should return LMSAssignmentModel if type is Assignments', async () => {
      const res = await service.getDocumentModel(LMSUpload.Assignments);
      expect(res).toBe(LMSAssignmentModel);
    });
  });

  describe('getDocumentModelAndItems', () => {
    let org: OrganizationModel;
    let orgInt: LMSOrganizationIntegrationModel;
    let course: CourseModel;
    let courseInt: LMSCourseIntegrationModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
      org = await OrganizationFactory.create();
      orgInt = await LMSOrganizationIntegrationModel.create({
        organizationId: org.id,
        rootUrl: 'www.example.com',
        apiPlatform: LMSIntegrationPlatform.Canvas,
      }).save();
      course = await CourseFactory.create();
      courseInt = await LMSCourseIntegrationModel.create({
        orgIntegration: orgInt,
        courseId: course.id,
        apiCourseId: 'abc',
        apiKey: 'def',
        apiKeyExpiry: new Date(0),
      }).save();
    });

    it('should return all matching assignments', async () => {
      for (let i = 1; i < 5; i++) {
        await LMSAssignmentModel.create({
          id: i,
          courseId: courseInt.courseId,
          name: `assignment${i}`,
          description: `description for assignment ${i}`,
          modified: new Date(),
          lmsSource: LMSIntegrationPlatform.Canvas,
          syncEnabled: i % 2 == 0,
        }).save();
      }
      const assignments = await LMSAssignmentModel.find({
        where: {
          courseId: courseInt.courseId,
          syncEnabled: true,
        },
      });
      const res = await service.getDocumentModelAndItems(
        course.id,
        LMSUpload.Assignments,
      );
      expect(res.model).toBe(LMSAssignmentModel);
      expect(res.items).toEqual(assignments);
    });

    it('should return all matching announcements', async () => {
      for (let i = 1; i < 5; i++) {
        await LMSAnnouncementModel.create({
          id: i,
          courseId: courseInt.courseId,
          title: `announcement${i}`,
          message: `description for announcement ${i}`,
          posted: new Date(),
          modified: new Date(),
          lmsSource: LMSIntegrationPlatform.Canvas,
          syncEnabled: i % 2 == 0,
        }).save();
      }
      const announcements = await LMSAnnouncementModel.find({
        where: {
          courseId: courseInt.courseId,
          syncEnabled: true,
        },
      });
      const res = await service.getDocumentModelAndItems(
        course.id,
        LMSUpload.Announcements,
      );
      expect(res.model).toBe(LMSAnnouncementModel);
      expect(res.items).toEqual(announcements);
    });
  });
});
