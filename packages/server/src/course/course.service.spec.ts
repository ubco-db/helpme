import { TestingModule, Test } from '@nestjs/testing';
import { DataSource, In, IsNull } from 'typeorm';
import {
  UserFactory,
  UserCourseFactory,
  CourseFactory,
  initFactoriesFromService,
  SemesterFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  CourseSettingsFactory,
  QueueFactory,
  QueueInviteFactory,
  QuestionTypeFactory,
} from '../../test/util/factories';
import { TestTypeOrmModule, TestConfigModule } from '../../test/util/testUtils';
import { CourseService } from './course.service';
import { UserModel } from 'profile/user.entity';
import { CourseModel } from './course.entity';
import {
  Role,
  UserPartial,
  OrganizationRole,
  CourseCloneAttributes,
  QueueTypes,
  QueueConfig,
} from '@koh/common';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { HttpException } from '@nestjs/common';
import { MailModule } from 'mail/mail.module';
import { ChatbotApiService } from 'chatbot/chatbot-api.service';
import { QueueModel } from 'queue/queue.entity';
import { QueueInviteModel } from 'queue/queue-invite.entity';
import { ChatbotDocPdfModel } from 'chatbot/chatbot-doc-pdf.entity';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { CourseSettingsModel } from './course_settings.entity';
import { SuperCourseModel } from './super-course.entity';

describe('CourseService', () => {
  let service: CourseService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        FactoryModule,
        MailModule,
        RedisModule.forRoot({
          readyLog: false,
          errorLog: true,
          commonOptions: {
            host: process.env.REDIS_HOST || 'localhost',
            port: 6379,
          },
          config: [
            {
              namespace: 'db',
            },
            {
              namespace: 'sub',
            },
            {
              namespace: 'pub',
            },
          ],
        }),
      ],
      providers: [
        CourseService,
        RedisProfileService,
        {
          provide: ChatbotApiService,
          useValue: {
            getChatbotSettings: jest.fn().mockImplementation(() =>
              Promise.resolve({
                metadata: {
                  modelName: 'gpt-3.5-turbo-0125',
                  prompt: 'Test prompt',
                  similarityThresholdDocuments: 0.6,
                  temperature: 0.7,
                  topK: 5,
                },
              }),
            ),
            updateChatbotSettings: jest.fn().mockResolvedValue({ ok: true }),
            cloneCourseDocuments: jest.fn().mockResolvedValue({
              newAggregateHelpmePDFIdMap: {
                '1': 'test-doc-id',
                '3': 'test-doc-id',
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CourseService>(CourseService);
    dataSource = module.get<DataSource>(DataSource);
    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('getUserInfo', () => {
    let profDanish: UserModel;
    let profIris: UserModel;
    let vera: UserModel;
    let tingwei: UserModel;
    let neel: UserModel;
    let sumit: UserModel;
    let angela: UserModel;
    let fundies1: CourseModel;
    let algo: CourseModel;
    // param defaults
    let page = 1;
    let pageSize = 10;
    let search = '';
    beforeEach(async () => {
      // Initialize courses
      fundies1 = await CourseFactory.create({
        name: 'Fundies 1',
      });
      algo = await CourseFactory.create({
        name: 'Algo',
      });
      // Initialize Danish as professor in both courses
      profDanish = await UserFactory.create({
        firstName: 'Danish',
        lastName: 'Farooq',
        email: 'dfarooq@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: profDanish,
        course: fundies1,
        role: Role.PROFESSOR,
      });
      await UserCourseFactory.create({
        user: profDanish,
        course: algo,
        role: Role.PROFESSOR,
      });
      profIris = await UserFactory.create({
        firstName: 'Iris',
        lastName: 'Liu',
        email: 'iliu@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: profIris,
        course: fundies1,
        role: Role.PROFESSOR,
      });
      // Initialize Vera as TA in both courses
      vera = await UserFactory.create({
        firstName: 'Vera',
        lastName: 'Kong',
        email: 'vkong@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: vera,
        course: fundies1,
        role: Role.TA,
      });
      await UserCourseFactory.create({
        user: vera,
        course: algo,
        role: Role.TA,
      });
      // Initialize Tingwei as TA in fundies and student in algo
      tingwei = await UserFactory.create({
        firstName: 'Tingwei',
        lastName: 'Shi',
        email: 'tshi@northeastern.edu',
        photoURL:
          'https://files.slack.com/files-pri/TE565NU79-F02K81U7S13/image_from_ios.jpg',
      });
      await UserCourseFactory.create({
        user: tingwei,
        course: fundies1,
        role: Role.TA,
      });
      await UserCourseFactory.create({
        user: tingwei,
        course: algo,
        role: Role.STUDENT,
      });
      // Initialize Neel as TA in fundies and not in algo
      neel = await UserFactory.create({
        firstName: 'Neel',
        lastName: 'Bhalla',
        email: 'nbhalla@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: neel,
        course: fundies1,
        role: Role.TA,
      });
      // Initialize Sumit as student in both
      sumit = await UserFactory.create({
        firstName: 'Sumit',
        lastName: 'De',
        email: 'sde@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: sumit,
        course: fundies1,
        role: Role.STUDENT,
      });
      await UserCourseFactory.create({
        user: sumit,
        course: algo,
        role: Role.STUDENT,
      });
      // Initialize Angela as student in only fundies
      angela = await UserFactory.create({
        firstName: 'Angela',
        lastName: 'Zheng',
        email: 'azheng@northeastern.edu',
      });
      await UserCourseFactory.create({
        user: angela,
        course: fundies1,
        role: Role.STUDENT,
      });
    });

    /*
        Fundies:
          profs - danish, iris
          tas - vera, tingwei, neel
          students - sumit, angela

        Algo:
          profs - danish
          tas - vera
          students - sumit, tingwei
    */

    it('returns nothing for a non-existing course id', async () => {
      const courseId = 3;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users).toEqual([]);
    });

    it('returns everyone for fundies, no role, no search term', async () => {
      const courseId = 1;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users.map((info) => info.name)).toEqual([
        'Angela Zheng',
        'Danish Farooq',
        'Iris Liu',
        'Neel Bhalla',
        'Sumit De',
        'Tingwei Shi',
        'Vera Kong',
      ]);
    });

    it('returns all professors for fundies', async () => {
      const courseId = 1;
      const role = [Role.PROFESSOR];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual([
        'Danish Farooq',
        'Iris Liu',
      ]);
    });

    it('returns all tas for fundies', async () => {
      const courseId = 1;
      const role = [Role.TA];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual([
        'Neel Bhalla',
        'Tingwei Shi',
        'Vera Kong',
      ]);
    });

    it('returns all students for fundies', async () => {
      const courseId = 1;
      const role = [Role.STUDENT];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual([
        'Angela Zheng',
        'Sumit De',
      ]);
    });

    it('returns all professors for algo', async () => {
      const courseId = 2;
      const role = [Role.PROFESSOR];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual(['Danish Farooq']);
    });

    it('returns all tas for algo', async () => {
      const courseId = 2;
      const role = [Role.TA];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual(['Vera Kong']);
    });

    it('returns all students for algo', async () => {
      const courseId = 2;
      const role = [Role.STUDENT];
      const resp = await service.getUserInfo(
        courseId,
        page,
        pageSize,
        search,
        role,
      );
      expect(resp.users.map((info) => info.name)).toEqual([
        'Sumit De',
        'Tingwei Shi',
      ]);
    });

    it('returns name, email, and photoURL for user', async () => {
      const courseId = 1;
      search = 'tingwei';
      const user = (await service.getUserInfo(courseId, page, pageSize, search))
        .users[0] as UserPartial;
      expect(user.name).toEqual('Tingwei Shi');
      expect(user.email).toEqual('tshi@northeastern.edu');
      expect(user.photoURL).toEqual(
        'https://files.slack.com/files-pri/TE565NU79-F02K81U7S13/image_from_ios.jpg',
      );
    });

    it('returns danish when search term is danish', async () => {
      const courseId = 1;
      const role = [Role.PROFESSOR];
      search = 'danish';
      const user = (
        await await service.getUserInfo(courseId, page, pageSize, search, role)
      ).users[0] as UserPartial;
      expect(user.name).toEqual('Danish Farooq');
    });

    it('returns danish when search term is farooq', async () => {
      const courseId = 1;
      const role = [Role.PROFESSOR];
      search = 'farooq';
      const user = (
        await service.getUserInfo(courseId, page, pageSize, search, role)
      ).users[0] as UserPartial;
      expect(user.name).toEqual('Danish Farooq');
    });

    it('returns danish when search term is the whole name', async () => {
      const courseId = 1;
      const role = [Role.PROFESSOR];
      search = 'Danish Farooq';
      const user = (
        await service.getUserInfo(courseId, page, pageSize, search, role)
      ).users[0];
      expect(user).toBeTruthy();
      expect(user.name).toEqual('Danish Farooq');
    });

    it('returns danish and sumit when search term is d', async () => {
      const courseId = 1;
      search = 'd';
      const resp = await service.getUserInfo(courseId, page, pageSize, search);
      expect(resp.users.map((info) => info.name)).toEqual([
        'Danish Farooq',
        'Sumit De',
      ]);
    });

    it('returns first three users for fundies when page size is 3', async () => {
      const courseId = 1;
      pageSize = 3;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users.map((info) => info.name)).toEqual([
        'Angela Zheng',
        'Danish Farooq',
        'Iris Liu',
      ]);
    });

    it('returns second three users for fundies when page size is 3 and page is 2', async () => {
      const courseId = 1;
      pageSize = 3;
      page = 2;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users.map((info) => info.name)).toEqual([
        'Neel Bhalla',
        'Sumit De',
        'Tingwei Shi',
      ]);
    });

    it('returns last user for fundies when page size is 3 and page is 3', async () => {
      const courseId = 1;
      pageSize = 3;
      page = 3;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users.map((info) => info.name)).toEqual(['Vera Kong']);
    });

    it('returns no users for fundies when page size is 3 and page is out of bounds', async () => {
      const courseId = 1;
      pageSize = 3;
      page = 4;
      const resp = await service.getUserInfo(courseId, page, pageSize);
      expect(resp.users.map((info) => info.name)).toEqual([]);
    });
  });

  describe('addStudentToCourse', () => {
    it('returns true when student added to course', async () => {
      const user = await UserFactory.create({ courses: [] });
      const course = await CourseFactory.create();

      const resp = await service.addStudentToCourse(course, user);

      expect(resp).toEqual(true);
    });

    it('returns false when student already in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();

      const resp = await service.addStudentToCourse(course, user);

      expect(resp).toEqual(false);
    });
  });

  describe('cloneCourse', () => {
    let professor: UserModel;
    let course: CourseModel;
    let newSemester: any;
    let organization: any;
    let chatToken: string;
    let queue1: QueueModel;
    let queue2: QueueModel;
    let queueInvite1: QueueInviteModel;
    let queueInvite2: QueueInviteModel;
    let courseSettings: CourseSettingsModel;
    let asyncCentreQuestionType1: QuestionTypeModel;
    let asyncCentreQuestionType2: QuestionTypeModel;
    let chatbotDocPdf: ChatbotDocPdfModel;

    async function ensureCloneWasSuccessful(
      originalCourseId: number,
      clonedCourseId: number,
    ) {
      // Get the original and cloned courses with their settings
      const originalCourse = await CourseModel.findOne({
        where: { id: originalCourseId },
        relations: ['courseSettings'],
      });

      const clonedCourse = await CourseModel.findOne({
        where: { id: clonedCourseId },
        relations: ['courseSettings'],
      });

      expect(clonedCourse).toBeTruthy();
      expect(clonedCourse.id).not.toEqual(originalCourse.id);
      expect(clonedCourse.name).toEqual(originalCourse.name);
      expect(clonedCourse.timezone).toEqual(originalCourse.timezone);

      // Check course settings
      expect(clonedCourse.courseSettings).toBeTruthy();
      expect(clonedCourse.courseSettings.courseId).toEqual(clonedCourse.id);
      expect(clonedCourse.courseSettings.chatBotEnabled).toEqual(
        originalCourse.courseSettings.chatBotEnabled,
      );
      expect(clonedCourse.courseSettings.asyncQueueEnabled).toEqual(
        originalCourse.courseSettings.asyncQueueEnabled,
      );
      expect(clonedCourse.courseSettings.queueEnabled).toEqual(
        originalCourse.courseSettings.queueEnabled,
      );
      expect(clonedCourse.courseSettings.scheduleOnFrontPage).toEqual(
        originalCourse.courseSettings.scheduleOnFrontPage,
      );

      // Check queues
      const originalQueues = await QueueModel.find({
        where: { courseId: originalCourseId },
        relations: {
          queueInvite: true,
          questionTypes: true,
        },
        order: { id: 'ASC' },
      });

      const clonedQueues = await QueueModel.find({
        where: { courseId: clonedCourseId },
        relations: {
          queueInvite: true,
          questionTypes: true,
        },
        order: { id: 'ASC' },
      });

      expect(clonedQueues.length).toEqual(originalQueues.length);

      for (let i = 0; i < clonedQueues.length; i++) {
        expect(clonedQueues[i].id).not.toEqual(originalQueues[i].id);
        expect(clonedQueues[i].courseId).toEqual(clonedCourseId);
        expect(clonedQueues[i].room).toEqual(originalQueues[i].room);
        expect(clonedQueues[i].type).toEqual(originalQueues[i].type);
        expect(clonedQueues[i].notes).toEqual(originalQueues[i].notes);
        expect(clonedQueues[i].isProfessorQueue).toEqual(
          originalQueues[i].isProfessorQueue,
        );
        expect(JSON.stringify(clonedQueues[i].config)).toEqual(
          JSON.stringify(originalQueues[i].config),
        );

        // Check queue invites
        if (originalQueues[i].queueInvite) {
          expect(clonedQueues[i].queueInvite).toBeTruthy();
          expect(clonedQueues[i].queueInvite.queueId).toEqual(
            clonedQueues[i].id,
          );
          expect(clonedQueues[i].queueInvite.willInviteToCourse).toEqual(
            originalQueues[i].queueInvite.willInviteToCourse,
          );
        }

        // Check question types for the queue
        const originalQueueQuestionTypes = await QuestionTypeModel.find({
          where: {
            cid: originalCourseId,
            queueId: originalQueues[i].id,
          },
          order: { id: 'ASC' },
        });

        const clonedQueueQuestionTypes = await QuestionTypeModel.find({
          where: {
            cid: clonedCourseId,
            queueId: clonedQueues[i].id,
          },
          order: { id: 'ASC' },
        });

        expect(clonedQueueQuestionTypes.length).toEqual(
          originalQueueQuestionTypes.length,
        );

        for (let j = 0; j < clonedQueueQuestionTypes.length; j++) {
          expect(clonedQueueQuestionTypes[j].id).not.toEqual(
            originalQueueQuestionTypes[j].id,
          );
          expect(clonedQueueQuestionTypes[j].cid).toEqual(clonedCourseId);
          expect(clonedQueueQuestionTypes[j].queueId).toEqual(
            clonedQueues[i].id,
          );
          expect(clonedQueueQuestionTypes[j].name).toEqual(
            originalQueueQuestionTypes[j].name,
          );
          expect(clonedQueueQuestionTypes[j].color).toEqual(
            originalQueueQuestionTypes[j].color,
          );
        }
      }

      // Check async centre question types
      const originalAsyncQuestionTypes = await QuestionTypeModel.find({
        where: {
          cid: originalCourseId,
          queueId: IsNull(),
        },
        order: { id: 'ASC' },
      });

      const clonedAsyncQuestionTypes = await QuestionTypeModel.find({
        where: {
          cid: clonedCourseId,
          queueId: IsNull(),
        },
        order: { id: 'ASC' },
      });

      expect(clonedAsyncQuestionTypes.length).toEqual(
        originalAsyncQuestionTypes.length,
      );

      for (let i = 0; i < clonedAsyncQuestionTypes.length; i++) {
        expect(clonedAsyncQuestionTypes[i].id).not.toEqual(
          originalAsyncQuestionTypes[i].id,
        );
        expect(clonedAsyncQuestionTypes[i].cid).toEqual(clonedCourseId);
        expect(clonedAsyncQuestionTypes[i].queueId).toBeNull();
        expect(clonedAsyncQuestionTypes[i].name).toEqual(
          originalAsyncQuestionTypes[i].name,
        );
        expect(clonedAsyncQuestionTypes[i].color).toEqual(
          originalAsyncQuestionTypes[i].color,
        );
      }

      // Check chatbot document PDFs
      const originalChatbotDocs = await ChatbotDocPdfModel.find({
        where: { courseId: originalCourseId },
        order: { idHelpMeDB: 'ASC' },
      });

      const clonedChatbotDocs = await ChatbotDocPdfModel.find({
        where: { courseId: clonedCourseId },
        order: { idHelpMeDB: 'ASC' },
      });

      expect(clonedChatbotDocs.length).toEqual(originalChatbotDocs.length);

      for (let i = 0; i < clonedChatbotDocs.length; i++) {
        expect(clonedChatbotDocs[i].idHelpMeDB).not.toEqual(
          originalChatbotDocs[i].idHelpMeDB,
        );
        expect(clonedChatbotDocs[i].courseId).toEqual(clonedCourseId);
        expect(clonedChatbotDocs[i].docName).toEqual(
          originalChatbotDocs[i].docName,
        );
        expect(clonedChatbotDocs[i].docIdChatbotDB).toEqual(
          originalChatbotDocs[i].docIdChatbotDB,
        );
        expect(clonedChatbotDocs[i].docSizeBytes).toEqual(
          originalChatbotDocs[i].docSizeBytes,
        );
        expect(clonedChatbotDocs[i].docData.toString()).toEqual(
          originalChatbotDocs[i].docData.toString(),
        );
      }

      // Check to make sure super course is created
      const superCourse = await SuperCourseModel.find({
        relations: { courses: true },
      });

      expect(superCourse).toBeTruthy();
      expect(superCourse.length).toEqual(1);
      expect(superCourse[0].courses.length).toEqual(2);
      expect(superCourse[0].courses.map((course) => course.id)).toEqual([
        originalCourseId,
        clonedCourseId,
      ]);
    }

    beforeEach(async () => {
      // Set up test data
      organization = await OrganizationFactory.create();
      const semester = await SemesterFactory.create({
        organization,
      });
      newSemester = await SemesterFactory.create({
        organization,
        name: 'New Test Semester',
      });

      professor = await UserFactory.create();
      await OrganizationUserFactory.create({
        organization,
        organizationUser: professor,
        role: OrganizationRole.ADMIN,
      });

      course = await CourseFactory.create({
        name: 'Test Course',
        sectionGroupName: '001',
        semester,
      });

      courseSettings = await CourseSettingsFactory.create({
        course,
        chatBotEnabled: true,
        asyncQueueEnabled: false,
        queueEnabled: true,
        scheduleOnFrontPage: false,
      });

      await UserCourseFactory.create({
        user: professor,
        course,
        role: Role.PROFESSOR,
      });

      const tempQueueConfig: QueueConfig = {
        fifo_queue_view_enabled: true,
        tag_groups_queue_view_enabled: true,
        default_view: 'fifo',
        minimum_tags: 1,
        tags: {
          tag1: {
            display_name: 'Tag 1',
            color_hex: '#000000',
          },
          tag2: {
            display_name: 'Tag 2',
            color_hex: '#FFFFFF',
          },
        },
      };

      // create queues
      queue1 = await QueueFactory.create({
        course,
        room: 'Test Queue',
        type: 'online',
        notes: 'Test Notes',
        isProfessorQueue: true,
        config: tempQueueConfig,
      });
      queue2 = await QueueFactory.create({
        course,
        room: 'Test Queue 2',
        type: 'hybrid',
        notes: 'Test Notes 2',
        isProfessorQueue: false,
        config: tempQueueConfig,
      });

      // create question types for queues (4 total, should correspond to what's in queue config)
      for (const [tagKey, tagValue] of Object.entries(tempQueueConfig.tags)) {
        await QuestionTypeFactory.create({
          queue: queue1,
          cid: course.id,
          name: tagValue.display_name,
          color: tagValue.color_hex,
          queueId: queue1.id,
        });
        await QuestionTypeFactory.create({
          queue: queue2,
          cid: course.id,
          name: tagValue.display_name,
          color: tagValue.color_hex,
          queueId: queue2.id,
        });
      }

      // create queue invites
      queueInvite1 = await QueueInviteFactory.create({
        queue: queue1,
      });
      queueInvite2 = await QueueInviteFactory.create({
        queue: queue2,
        willInviteToCourse: true,
      });

      // create question types for async centre (null queueId)
      asyncCentreQuestionType1 = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Question Type 1',
        color: '#000000',
        queueId: null,
      });
      asyncCentreQuestionType2 = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Question Type 2',
        color: '#FFFFFF',
        queueId: null,
      });
      // create chatbot document pdf
      chatbotDocPdf = await ChatbotDocPdfModel.create({
        course: course,
        docName: 'Test Document',
        docData: Buffer.from('Test Data'),
        docSizeBytes: 100,
        docIdChatbotDB: 'test-doc-id',
      }).save();

      chatToken = 'test-chat-token';
    });

    it('should successfully clone a course with a new section', async () => {
      const cloneData: CourseCloneAttributes = {
        professorIds: [professor.id],
        useSection: true,
        newSection: '002',
        associateWithOriginalCourse: true,
        toClone: {
          coordinator_email: true,
          zoomLink: true,
          courseInviteCode: true,
          courseFeatureConfig: true,
          asyncCentreQuestionTypes: true,
          queues: true,
          queueInvites: true,
          chatbot: {
            documents: true,
            manuallyCreatedChunks: true,
            insertedQuestions: true,
            insertedLMSData: true,
          },
        },
      };

      const result = await service.cloneCourse(
        course.id,
        professor.id,
        cloneData,
        chatToken,
      );

      expect(result).toBeTruthy();
      expect(result?.course.name).toBe('Test Course');
      expect(result?.course.sectionGroupName).toBe('002');
      expect(result?.role).toBe(Role.PROFESSOR);

      // Verify all cloned data is correct
      await ensureCloneWasSuccessful(course.id, result.course.id);
    });

    it('should successfully clone a course with a new semester', async () => {
      const cloneData: CourseCloneAttributes = {
        professorIds: [professor.id],
        useSection: false,
        newSemesterId: newSemester.id,
        associateWithOriginalCourse: true,
        toClone: {
          coordinator_email: true,
          zoomLink: true,
          courseInviteCode: true,
          courseFeatureConfig: true,
          asyncCentreQuestionTypes: true,
          queues: true,
          queueInvites: true,
          chatbot: {
            documents: true,
            manuallyCreatedChunks: true,
            insertedQuestions: true,
            insertedLMSData: true,
          },
        },
      };

      const result = await service.cloneCourse(
        course.id,
        professor.id,
        cloneData,
        chatToken,
      );

      expect(result).toBeTruthy();
      expect(result?.course.name).toBe('Test Course');
      expect(result?.course.sectionGroupName).toBe('001');
      expect(result?.role).toBe(Role.PROFESSOR);

      // Verify all cloned data is correct
      await ensureCloneWasSuccessful(course.id, result.course.id);
    });

    it('should clone a course and add it to an existing super course if the original course already had a super course', async () => {
      const extraTempCourse = await CourseFactory.create({
        name: 'Extra Temp Course',
        sectionGroupName: '002',
        semester: newSemester,
      });
      const superCourse = await SuperCourseModel.create({
        name: course.name,
        organization,
      }).save();
      extraTempCourse.superCourseId = superCourse.id;
      await extraTempCourse.save();
      course.superCourseId = superCourse.id;
      await course.save();

      const cloneData: CourseCloneAttributes = {
        professorIds: [professor.id],
        useSection: false,
        newSemesterId: newSemester.id,
        associateWithOriginalCourse: true,
        toClone: {
          coordinator_email: true,
          zoomLink: true,
        },
      };

      const result = await service.cloneCourse(
        course.id,
        professor.id,
        cloneData,
        chatToken,
      );

      expect(result).toBeTruthy();
      expect(result?.course.name).toBe(course.name);
      expect(result?.course.sectionGroupName).toBe('001');
      expect(result?.role).toBe(Role.PROFESSOR);

      // not verifying if cloned data is correct for this one. Just testing to see if the supercourse got a new course appended to it
      const updatedSuperCourse = await SuperCourseModel.findOne({
        where: { id: superCourse.id },
        relations: ['courses'],
      });
      expect(updatedSuperCourse).toBeTruthy();
      expect(updatedSuperCourse.courses.length).toEqual(3);
      expect(updatedSuperCourse.courses.map((course) => course.id)).toEqual(
        expect.arrayContaining([
          result.course.id,
          extraTempCourse.id,
          course.id,
        ]),
      );
    });
    it('should throw error when neither new section nor new semester is specified', async () => {
      const cloneData: CourseCloneAttributes = {
        professorIds: [professor.id],
        useSection: false,
        associateWithOriginalCourse: true,
        toClone: {
          coordinator_email: true,
          zoomLink: true,
          courseInviteCode: true,
          courseFeatureConfig: true,
          asyncCentreQuestionTypes: true,
          queues: true,
          queueInvites: true,
          chatbot: {
            documents: true,
            manuallyCreatedChunks: true,
            insertedQuestions: true,
            insertedLMSData: true,
          },
        },
      };

      await expect(
        service.cloneCourse(course.id, professor.id, cloneData, chatToken),
      ).rejects.toThrow(HttpException);
    });
  });
});
