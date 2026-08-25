import {
  AlertDeliveryMode,
  AlertType,
  AsyncQuestionUpdatePayload,
  RephraseQuestionPayload,
  AdminNoticePayload,
  AdminNoticeToastPayload,
  ToastType,
  AsyncQuestionUpdateSubtype,
  OrganizationRole,
  Role,
} from '@koh/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AlertFactory,
  CourseFactory,
  initFactoriesFromService,
  OrganizationFactory,
  OrganizationUserFactory,
  QueueFactory,
  QueueStaffFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserCourseFactory,
  UserFactory,
} from '../../test/util/factories';
import { TestTypeOrmModule } from '../../test/util/testUtils';
import { AlertsService, formatAlertForFrontend } from './alerts.service';
import { DataSource, EntityManager } from 'typeorm';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { AlertModel } from './alerts.entity';
import { CourseModel } from 'course/course.entity';
import { UserModel } from 'profile/user.entity';
import { OrganizationModel } from 'organization/organization.entity';

describe('Alerts service', () => {
  let service: AlertsService;
  let dataSource: DataSource;
  let manager: EntityManager;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, FactoryModule],
      providers: [AlertsService],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    dataSource = module.get<DataSource>(DataSource);

    const factories = module.get<FactoryService>(FactoryService);
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
    manager = dataSource.manager;
  });

  describe('formatAlertForFrontend', () => {
    it('formats an alert correctly', async () => {
      const course = await CourseFactory.create({ name: 'Test Course' });
      const alert = await AlertFactory.create({
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        payload: {
          questionId: 1,
          queueId: 1,
          courseId: course.id,
        } satisfies RephraseQuestionPayload,
      });

      const dbAlert = await AlertModel.findOne({
        where: { id: alert.id },
        relations: { course: true },
      });

      const formatted = formatAlertForFrontend(dbAlert);
      expect(formatted).toEqual(
        expect.objectContaining({
          id: alert.id,
          sentAt: alert.sentAt,
          alertType: alert.alertType,
          payload: alert.payload,
          deliveryMode: alert.deliveryMode,
          readAt: alert.readAt,
          courseId: alert.courseId,
          courseName: 'Test Course',
        }),
      );
    });
  });

  describe('assertPayloadType', () => {
    it('correct rephrase question payloads pass', () => {
      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 2,
          queueId: 1,
          questionId: 420,
        } satisfies RephraseQuestionPayload),
      ).toBeTruthy();
    });

    it('incorrect rephrase question payloads fail', () => {
      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 'PYHUGYHIF',
          queueId: 1,
          questionId: 420,
        } as unknown as RephraseQuestionPayload),
      ).toBeFalsy();

      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 69,
          questionId: 420,
        } as unknown as RephraseQuestionPayload),
      ).toBeFalsy();

      expect(
        service.assertPayloadType(AlertType.REPHRASE_QUESTION, {
          courseId: 69,
          queueId: '12',
          questionId: 420,
        } as unknown as RephraseQuestionPayload),
      ).toBeFalsy();
    });
  });

  describe('getUnresolvedRephraseQuestionAlert', () => {
    it('gets unresolved alerts for the correct queueId', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta.user });

      const openAlert = await AlertFactory.create({
        user: ta.user,
        course: queue.course,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
        payload: {
          questionId: 1,
          queueId: queue.id,
          courseId: queue.course.id,
        } satisfies RephraseQuestionPayload,
      });

      // read alert (should not be fetched)
      await AlertFactory.create({
        user: ta.user,
        course: queue.course,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: new Date(),
        payload: {
          questionId: 2,
          queueId: queue.id,
          courseId: queue.course.id,
        } satisfies RephraseQuestionPayload,
      });

      // alert for a different queue (should not be fetched)
      await AlertFactory.create({
        user: ta.user,
        course: queue.course,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
        payload: {
          questionId: 3,
          queueId: queue.id + 999,
          courseId: queue.course.id,
        } satisfies RephraseQuestionPayload,
      });

      const unresolvedAlerts = await service.getUnresolvedRephraseQuestionAlert(
        queue.id,
        manager,
      );

      expect(unresolvedAlerts.length).toBe(1);
      expect(unresolvedAlerts[0].id).toBe(openAlert.id);
      expect(unresolvedAlerts[0].readAt).toBeNull();
      expect(unresolvedAlerts[0].alertType).toBe(AlertType.REPHRASE_QUESTION);
      expect(unresolvedAlerts[0].payload['queueId']).toBe(queue.id);
    });
  });

  describe('Alert Fetchers (Modal, Feed, Toast)', () => {
    let user: UserModel;
    let course1: CourseModel;
    let course2: CourseModel;

    beforeEach(async () => {
      user = await UserFactory.create();
      course1 = await CourseFactory.create();
      course2 = await CourseFactory.create();
    });

    describe('getModalAlerts', () => {
      it('fetches unread modal alerts prioritizing courseId or null courseId, ordered by sentAt DESC', async () => {
        const nullCourseAlert = await AlertFactory.create({
          user,
          course: null,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.ADMIN_NOTICE,
          readAt: null,
          sentAt: new Date(Date.now() - 1000), // older
          payload: {
            title: 'Test',
            message: 'test message',
            creatorName: 'System',
            creatorId: -1,
          } satisfies AdminNoticePayload,
        });

        const course1Alert = await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.REPHRASE_QUESTION,
          readAt: null,
          sentAt: new Date(), // newer
          payload: {
            questionId: 1,
            queueId: 1,
            courseId: course1.id,
          } satisfies RephraseQuestionPayload,
        });

        // course2 alert shouldn't be included if querying for course1
        await AlertFactory.create({
          user,
          course: course2,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.REPHRASE_QUESTION,
          readAt: null,
          payload: {
            questionId: 1,
            queueId: 1,
            courseId: course2.id,
          } satisfies RephraseQuestionPayload,
        });

        // read alert shouldn't be included
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.REPHRASE_QUESTION,
          readAt: new Date(),
          payload: {
            questionId: 1,
            queueId: 1,
            courseId: course1.id,
          } satisfies RephraseQuestionPayload,
        });

        const alerts = await service.getModalAlerts(
          user.id,
          manager,
          course1.id,
        );

        expect(alerts).toHaveLength(2);
        // Ordering by sentAt DESC
        expect(alerts[0].id).toBe(course1Alert.id);
        expect(alerts[1].id).toBe(nullCourseAlert.id);
      });

      it('fetches only null courseId alerts if no courseId is provided', async () => {
        const nullCourseAlert = await AlertFactory.create({
          user,
          course: null,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.ADMIN_NOTICE,
          readAt: null,
          payload: {
            title: 'Test Null',
            message: 'test message',
            creatorName: 'System',
            creatorId: -1,
          } satisfies AdminNoticePayload,
        });

        // shouldn't be included
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.MODAL,
          alertType: AlertType.REPHRASE_QUESTION,
          readAt: null,
          payload: {
            questionId: 1,
            queueId: 1,
            courseId: course1.id,
          } satisfies RephraseQuestionPayload,
        });

        const alerts = await service.getModalAlerts(user.id, manager);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].id).toBe(nullCourseAlert.id);
      });
    });

    describe('getFeedAlerts', () => {
      it('fetches all read and unread feed alerts correctly paginated', async () => {
        // Create 3 feed alerts
        for (let i = 0; i < 3; i++) {
          await AlertFactory.create({
            user,
            course: course1,
            deliveryMode: AlertDeliveryMode.FEED,
            alertType: AlertType.ASYNC_QUESTION_UPDATE,
            readAt: i % 2 === 0 ? null : new Date(), // alternate unread/read
            sentAt: new Date(Date.now() - i * 1000),
            payload: {
              questionId: 1,
              courseId: course1.id,
              subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
            } satisfies AsyncQuestionUpdatePayload,
          });
        }

        // Should not be included
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.MODAL, // wrong mode
          alertType: AlertType.REPHRASE_QUESTION,
          payload: {
            questionId: 1,
            queueId: 1,
            courseId: course1.id,
          } satisfies RephraseQuestionPayload,
        });

        const [alerts, count] = await service.getFeedAlerts(
          user.id,
          manager,
          2, // limit
          0, // offset
          'all',
          course1.id,
        );

        expect(count).toBe(3);
        expect(alerts).toHaveLength(2);
        // Check order: null readAt first, then readAt DESC, then sentAt DESC
        expect(alerts[0].readAt).toBeNull();
      });

      it('filters by status correctly', async () => {
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.FEED,
          alertType: AlertType.ASYNC_QUESTION_UPDATE,
          readAt: null, // unread
          payload: {
            questionId: 1,
            courseId: course1.id,
            subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
          } satisfies AsyncQuestionUpdatePayload,
        });
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.FEED,
          alertType: AlertType.ASYNC_QUESTION_UPDATE,
          readAt: new Date(), // read (dismissed)
          payload: {
            questionId: 1,
            courseId: course1.id,
            subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
          } satisfies AsyncQuestionUpdatePayload,
        });

        const [unreadAlerts] = await service.getFeedAlerts(
          user.id,
          manager,
          10,
          0,
          'unread',
        );
        expect(unreadAlerts).toHaveLength(1);
        expect(unreadAlerts[0].readAt).toBeNull();

        const [dismissedAlerts] = await service.getFeedAlerts(
          user.id,
          manager,
          10,
          0,
          'dismissed',
        );
        expect(dismissedAlerts).toHaveLength(1);
        expect(dismissedAlerts[0].readAt).not.toBeNull();
      });
    });

    describe('getToastAlerts', () => {
      it('fetches unread toast alerts regardless of courseId, ordered by sentAt ASC', async () => {
        const newerAlert = await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.TOAST,
          alertType: AlertType.ADMIN_NOTICE,
          readAt: null,
          sentAt: new Date(),
          payload: {
            title: 'Toast',
            description: 'msg',
            toastType: ToastType.INFO,
            creatorName: 'System',
            creatorId: -1,
          } satisfies AdminNoticeToastPayload,
        });
        const olderAlert = await AlertFactory.create({
          user,
          course: course2,
          deliveryMode: AlertDeliveryMode.TOAST,
          alertType: AlertType.ADMIN_NOTICE,
          readAt: null,
          sentAt: new Date(Date.now() - 10000),
          payload: {
            title: 'Toast 2',
            description: 'msg 2',
            toastType: ToastType.INFO,
            creatorName: 'System',
            creatorId: -1,
          } satisfies AdminNoticeToastPayload,
        });

        // Read alert should not be included
        await AlertFactory.create({
          user,
          course: course1,
          deliveryMode: AlertDeliveryMode.TOAST,
          alertType: AlertType.ADMIN_NOTICE,
          readAt: new Date(),
          payload: {
            title: 'Toast 3',
            description: 'msg 3',
            toastType: ToastType.INFO,
            creatorName: 'System',
            creatorId: -1,
          } satisfies AdminNoticeToastPayload,
        });

        const alerts = await service.getToastAlerts(user.id, manager);
        expect(alerts).toHaveLength(2);
        // Order by sentAt ASC
        expect(alerts[0].id).toBe(olderAlert.id);
        expect(alerts[1].id).toBe(newerAlert.id);
      });
    });
  });

  describe('getTargetUserIds', () => {
    let org: OrganizationModel;
    let course: CourseModel;
    let student: UserModel;
    let prof: UserModel;
    let otherUser: UserModel;

    beforeEach(async () => {
      org = await OrganizationFactory.create();
      course = await CourseFactory.create();

      student = await UserFactory.create();
      prof = await UserFactory.create();
      otherUser = await UserFactory.create();

      await OrganizationUserFactory.create({
        organization: org,
        organizationUser: student,
      });
      await OrganizationUserFactory.create({
        organization: org,
        organizationUser: prof,
        role: OrganizationRole.PROFESSOR,
      });

      await StudentCourseFactory.create({ course, user: student });
      await UserCourseFactory.create({
        course,
        user: prof,
        role: Role.PROFESSOR,
      });
    });

    it('returns all users when target is empty', async () => {
      const userIds = await service.getTargetUserIds(null, manager);
      expect(userIds.length).toBeGreaterThanOrEqual(3);
      expect(userIds).toEqual(
        expect.arrayContaining([student.id, prof.id, otherUser.id]),
      );
    });

    it('returns specific user id when target.userId is provided', async () => {
      const userIds = await service.getTargetUserIds(
        { userId: student.id },
        manager,
      );
      expect(userIds).toHaveLength(1);
      expect(userIds[0]).toBe(student.id);
    });

    it('throws error if target.userId does not exist', async () => {
      await expect(
        service.getTargetUserIds({ userId: 999999 }, manager),
      ).rejects.toThrow('User with id 999999 not found');
    });

    it('returns users in an organization', async () => {
      const userIds = await service.getTargetUserIds(
        { orgId: org.id },
        manager,
      );
      expect(userIds).toHaveLength(2);
      expect(userIds).toEqual(expect.arrayContaining([student.id, prof.id]));
    });

    it('returns users in an organization filtered by role', async () => {
      const userIds = await service.getTargetUserIds(
        { orgId: org.id, orgRole: OrganizationRole.PROFESSOR },
        manager,
      );
      expect(userIds).toHaveLength(1);
      expect(userIds[0]).toBe(prof.id);
    });

    it('returns users in a course', async () => {
      const userIds = await service.getTargetUserIds(
        { courseId: course.id },
        manager,
      );
      expect(userIds).toHaveLength(2);
      expect(userIds).toEqual(expect.arrayContaining([student.id, prof.id]));
    });

    it('returns users in a course filtered by role', async () => {
      const userIds = await service.getTargetUserIds(
        { courseId: course.id, courseRole: Role.PROFESSOR },
        manager,
      );
      expect(userIds).toHaveLength(1);
      expect(userIds[0]).toBe(prof.id);
    });
  });
});
