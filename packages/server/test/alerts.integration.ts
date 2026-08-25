import {
  Alert,
  AlertDeliveryMode,
  AlertType,
  AdminNoticePayload,
  AdminNoticeToastPayload,
  ChatbotDocumentProcessedPayload,
  CreateAlertAdminResponse,
  CreateAlertResponse,
  DeleteAdminNoticeResponse,
  ERROR_MESSAGES,
  GetAdminNoticeAlert,
  GetInitialAlertsResponse,
  GetPageOfFeedAlerts,
  RephraseQuestionPayload,
  Role,
  ToastType,
  UserRole,
  AsyncQuestionUpdatePayload,
  AsyncQuestionUpdateSubtype,
} from '@koh/common';
import { AlertsModule } from 'alerts/alerts.module';
import { AlertModel } from 'alerts/alerts.entity';
import { UserModel } from 'profile/user.entity';
import { QueueModel } from 'queue/queue.entity';
import {
  AlertFactory,
  CourseFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  QueueFactory,
  QueueStaffFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserFactory,
} from './util/factories';
import {
  setupIntegrationTest,
  overrideEmailService,
  expectEmailNotSent,
} from './util/testUtils';
import { OrganizationModel } from 'organization/organization.entity';
import { CourseModel } from 'course/course.entity';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Count alerts in the DB, optionally filtering by fields. */
async function countAlerts(
  where: Partial<{
    userId: number;
    deliveryMode: AlertDeliveryMode;
    alertType: AlertType;
  }> = {},
): Promise<number> {
  return AlertModel.count({ where });
}

/** Get all alerts for a user from the DB, with course relation. */
async function getAlertsForUser(userId: number): Promise<AlertModel[]> {
  return AlertModel.find({
    where: { userId },
    relations: { course: true },
    order: { sentAt: 'DESC' },
  });
}

/** Standard payload for REPHRASE_QUESTION alerts. */
function rephrasePayload(
  courseId: number,
  queueId: number,
  questionId: number,
) {
  return { courseId, queueId, questionId } satisfies RephraseQuestionPayload;
}

/** Standard payload for ADMIN_NOTICE modal/feed alerts. */
function adminNoticePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Notice',
    message: 'This is a test admin notice',
    creatorName: 'ignored',
    creatorId: -1,
    ...overrides,
  } satisfies AdminNoticePayload;
}

/** Standard payload for ADMIN_NOTICE toast alerts. */
function adminNoticeToastPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Toast Notice',
    description: 'This is a toast notice',
    toastType: ToastType.INFO,
    creatorName: 'ignored',
    creatorId: -1,
    ...overrides,
  } satisfies AdminNoticeToastPayload;
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('Alerts Integration', () => {
  const { supertest } = setupIntegrationTest(
    AlertsModule,
    overrideEmailService,
  );

  // Shared entities created in beforeEach
  let student: UserModel;
  let ta: UserModel;
  let adminUser: UserModel;
  let otherUser: UserModel;

  let org: OrganizationModel;
  let course: CourseModel;
  let course2: CourseModel;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Users
    student = await UserFactory.create({ email: 'student@test.com' });
    ta = await UserFactory.create({ email: 'ta@test.com' });
    adminUser = await UserFactory.create({
      email: 'admin@test.com',
      userRole: UserRole.ADMIN,
    });
    otherUser = await UserFactory.create({ email: 'other@test.com' });

    // Organization
    org = await OrganizationFactory.create({ name: 'Test Org' });

    // Courses
    course = await CourseFactory.create({ name: 'Course 1' });
    course2 = await CourseFactory.create({ name: 'Course 2' });
    await OrganizationCourseFactory.create({ organization: org, course });
    await OrganizationCourseFactory.create({
      organization: org,
      course: course2,
    });

    // Enrollments
    await StudentCourseFactory.create({ user: student, course });
    await StudentCourseFactory.create({ user: student, course: course2 });
    await TACourseFactory.create({ user: ta, course });
    await TACourseFactory.create({ user: ta, course: course2 });
    await StudentCourseFactory.create({ user: otherUser, course });

    // Org memberships
    await OrganizationUserFactory.create({
      organizationUser: student,
      organization: org,
    });
    await OrganizationUserFactory.create({
      organizationUser: ta,
      organization: org,
    });
    await OrganizationUserFactory.create({
      organizationUser: adminUser,
      organization: org,
    });
    await OrganizationUserFactory.create({
      organizationUser: otherUser,
      organization: org,
    });
  });

  // ─── PATCH /alerts/mark-read-all-feed ──────────────────────────────────────

  describe('PATCH /alerts/mark-read-all-feed', () => {
    it('marks all unread feed alerts as read for the user', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });
      await AlertFactory.create({
        user: student,
        course: course2,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });

      await supertest({ userId: student.id })
        .patch('/alerts/mark-read-all-feed')
        .expect(200);

      const dbAlerts = await getAlertsForUser(student.id);
      expect(dbAlerts).toHaveLength(2);
      dbAlerts.forEach((a) => {
        expect(a.readAt).not.toBeNull();
      });
    });

    it("does not affect other users' alerts", async () => {
      const studentAlert = await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });
      const otherAlert = await AlertFactory.create({
        user: otherUser,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });

      await supertest({ userId: student.id })
        .patch('/alerts/mark-read-all-feed')
        .expect(200);

      const dbStudentAlert = await AlertModel.findOneBy({
        id: studentAlert.id,
      });
      const dbOtherAlert = await AlertModel.findOneBy({ id: otherAlert.id });
      expect(dbStudentAlert.readAt).not.toBeNull();
      expect(dbOtherAlert.readAt).toBeNull();
    });

    it('does not affect MODAL or TOAST alerts', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });
      const modalAlert = await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });
      const toastAlert = await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.TOAST,
        alertType: AlertType.ADMIN_NOTICE,
        readAt: null,
      });

      await supertest({ userId: student.id })
        .patch('/alerts/mark-read-all-feed')
        .expect(200);

      const dbModalAlert = await AlertModel.findOneBy({ id: modalAlert.id });
      const dbToastAlert = await AlertModel.findOneBy({ id: toastAlert.id });
      expect(dbModalAlert.readAt).toBeNull();
      expect(dbToastAlert.readAt).toBeNull();
    });

    it('no-op when user has no unread feed alerts', async () => {
      // Already-read alert
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: new Date(),
      });

      await supertest({ userId: student.id })
        .patch('/alerts/mark-read-all-feed')
        .expect(200);

      // Alert should still be read with original readAt
      const dbAlerts = await getAlertsForUser(student.id);
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].readAt).not.toBeNull();
    });
  });

  // ─── GET /alerts/feed ──────────────────────────────────────────────────────

  describe('GET /alerts/feed', () => {
    it('returns feed alerts with correct shape', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        payload: {
          questionId: 1,
          courseId: course.id,
          subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
        } satisfies AsyncQuestionUpdatePayload,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=${course.id}&limit=20&offset=0`)
        .expect(200);

      const body = res.body as GetPageOfFeedAlerts;
      expect(body).toMatchObject({
        totalFeedAlerts: 1,
        pageOfFeedAlerts: [
          {
            id: expect.any(Number),
            sentAt: expect.any(String),
            alertType: AlertType.ASYNC_QUESTION_UPDATE,
            deliveryMode: AlertDeliveryMode.FEED,
            courseName: course.name,
            payload: expect.objectContaining({
              questionId: 1,
              courseId: course.id,
              subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
            }),
          },
        ],
      });
    });

    it('pagination works correctly', async () => {
      // Create 5 feed alerts
      for (let i = 0; i < 5; i++) {
        await AlertFactory.create({
          user: student,
          course,
          deliveryMode: AlertDeliveryMode.FEED,
          alertType: AlertType.ASYNC_QUESTION_UPDATE,
          sentAt: new Date(Date.now() - i * 1000),
        });
      }

      const page1 = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=2&offset=0`)
        .expect(200);
      const page1Body = page1.body as GetPageOfFeedAlerts;
      expect(page1Body.pageOfFeedAlerts).toHaveLength(2);
      expect(page1Body.totalFeedAlerts).toBe(5);

      const page2 = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=2&offset=2`)
        .expect(200);
      const page2Body = page2.body as GetPageOfFeedAlerts;
      expect(page2Body.pageOfFeedAlerts).toHaveLength(2);
      expect(page2Body.totalFeedAlerts).toBe(5);

      // Last page
      const page3 = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=2&offset=4`)
        .expect(200);
      const page3Body = page3.body as GetPageOfFeedAlerts;
      expect(page3Body.pageOfFeedAlerts).toHaveLength(1);
    });

    it('filters by courseId (returns matching + null-courseId alerts)', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      await AlertFactory.create({
        user: student,
        course: course2,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      // Null-courseId alert (should be included when filtering by any courseId)
      await AlertFactory.create({
        user: student,
        course: null,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ADMIN_NOTICE,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=${course.id}&limit=20&offset=0`)
        .expect(200);

      const body = res.body as GetPageOfFeedAlerts;
      expect(body.totalFeedAlerts).toBe(2); // course1 + null
      expect(body.pageOfFeedAlerts).toHaveLength(2);
    });

    it('returns both read and unread alerts', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: null,
      });
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: new Date(),
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=20&offset=0`)
        .expect(200);

      const body = res.body as GetPageOfFeedAlerts;
      expect(body.totalFeedAlerts).toBe(2);
      expect(body.pageOfFeedAlerts).toHaveLength(2);
    });

    it("does not return other users' alerts", async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      await AlertFactory.create({
        user: otherUser,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=20&offset=0`)
        .expect(200);

      const body = res.body as GetPageOfFeedAlerts;
      expect(body.totalFeedAlerts).toBe(1);
    });

    it('does not return MODAL or TOAST alerts', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
      });
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.TOAST,
        alertType: AlertType.ADMIN_NOTICE,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/feed?courseId=-1&limit=20&offset=0`)
        .expect(200);

      const body = res.body as GetPageOfFeedAlerts;
      expect(body.totalFeedAlerts).toBe(1);
      expect(body.pageOfFeedAlerts[0].deliveryMode).toBe(
        AlertDeliveryMode.FEED,
      );
    });
  });

  // ─── GET /alerts/initial ───────────────────────────────────────────────────

  describe('GET /alerts/initial', () => {
    it('returns correct shape with mostAlerts and totalFeedAlerts', async () => {
      const res = await supertest({ userId: student.id })
        .get(`/alerts/initial?courseId=${course.id}`)
        .expect(200);

      const body = res.body as GetInitialAlertsResponse;
      expect(body).toMatchObject({
        mostAlerts: expect.any(Array),
        totalFeedAlerts: expect.any(Number),
      });
    });

    it('includes all delivery modes in mostAlerts', async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.TOAST,
        alertType: AlertType.ADMIN_NOTICE,
        readAt: null,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/initial?courseId=${course.id}`)
        .expect(200);

      const body = res.body as GetInitialAlertsResponse;
      const modes = body.mostAlerts.map((a) => a.deliveryMode);
      expect(modes).toEqual(
        expect.arrayContaining([
          AlertDeliveryMode.MODAL,
          AlertDeliveryMode.FEED,
          AlertDeliveryMode.TOAST,
        ]),
      );
      expect(body.totalFeedAlerts).toBe(1);
    });

    it('modal alerts filter by courseId (null + matching courseId)', async () => {
      // Modal alert for course1
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });
      // Modal alert with null courseId (global)
      await AlertFactory.create({
        user: student,
        course: null,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.ADMIN_NOTICE,
        readAt: null,
      });
      // Modal alert for course2 (should NOT appear when filtering by course1)
      await AlertFactory.create({
        user: student,
        course: course2,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/initial?courseId=${course.id}`)
        .expect(200);

      const body = res.body as GetInitialAlertsResponse;
      const modalAlerts = body.mostAlerts.filter(
        (a) => a.deliveryMode === AlertDeliveryMode.MODAL,
      );
      expect(modalAlerts).toHaveLength(2); // course1 + null
    });

    it('only returns unread modal and toast alerts, but includes read feed alerts', async () => {
      // Read modal alert (should NOT appear)
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: new Date(),
      });
      // Unread modal alert (should appear)
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });
      // Read toast alert (should NOT appear)
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.TOAST,
        alertType: AlertType.ADMIN_NOTICE,
        readAt: new Date(),
      });
      // Read feed alert (SHOULD appear since feed returns all)
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
        readAt: new Date(),
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/initial?courseId=${course.id}`)
        .expect(200);

      const body = res.body as GetInitialAlertsResponse;
      const modalAlerts = body.mostAlerts.filter(
        (a) => a.deliveryMode === AlertDeliveryMode.MODAL,
      );
      const toastAlerts = body.mostAlerts.filter(
        (a) => a.deliveryMode === AlertDeliveryMode.TOAST,
      );
      const feedAlerts = body.mostAlerts.filter(
        (a) => a.deliveryMode === AlertDeliveryMode.FEED,
      );
      expect(modalAlerts).toHaveLength(1);
      expect(toastAlerts).toHaveLength(0);
      expect(feedAlerts).toHaveLength(1); // read feed alert is included
    });

    it("does not return other users' alerts", async () => {
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });
      await AlertFactory.create({
        user: otherUser,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });

      const res = await supertest({ userId: student.id })
        .get(`/alerts/initial?courseId=${course.id}`)
        .expect(200);

      const body = res.body as GetInitialAlertsResponse;
      expect(body.mostAlerts).toHaveLength(1);
    });
  });

  // ─── POST /alerts/create-alert/:courseId ────────────────────────────────────

  describe('POST /alerts/create-alert/:courseId', () => {
    let queue: QueueModel;

    beforeEach(async () => {
      queue = await QueueFactory.create({ course });
      await QueueStaffFactory.create({ queue, user: ta });
    });

    it.each([
      {
        mode: AlertDeliveryMode.MODAL,
        type: AlertType.REPHRASE_QUESTION,
        getPayload: (qId: number) => rephrasePayload(course.id, qId, 999),
      },
      {
        mode: AlertDeliveryMode.FEED,
        type: AlertType.ASYNC_QUESTION_UPDATE,
        getPayload: () =>
          ({
            questionId: 1,
            courseId: course.id,
            subtype: AsyncQuestionUpdateSubtype.HUMAN_ANSWERED,
          }) satisfies AsyncQuestionUpdatePayload,
      },
      {
        mode: AlertDeliveryMode.TOAST,
        type: AlertType.CHATBOT_DOCUMENT_PROCESSED,
        getPayload: () =>
          ({
            documentId: 1,
            documentName: 'test.pdf',
            uploadId: 'abc123',
            toastType: ToastType.SUCCESS,
            title: 'Document processed',
          }) satisfies ChatbotDocumentProcessedPayload,
      },
    ])(
      'creates a $mode alert and verifies DB',
      async ({ mode, type, getPayload }) => {
        const payload = getPayload(queue.id);
        const res = await supertest({ userId: ta.id })
          .post(`/alerts/create-alert/${course.id}`)
          .send({
            alertType: type,
            courseId: course.id,
            targetUserId: student.id,
            deliveryMode: mode,
            payload,
          })
          .expect(201);

        const body = res.body as CreateAlertResponse;
        expect(body).toMatchObject({
          alertType: type,
          deliveryMode: mode,
        });

        const dbAlert = await AlertModel.findOneBy({ id: body.id });
        expect(dbAlert).toMatchObject({
          userId: student.id,
          courseId: course.id,
          deliveryMode: mode,
          readAt: null,
          payload,
        });
      },
    );

    it('defaults to MODAL when deliveryMode not specified', async () => {
      const payload = rephrasePayload(course.id, queue.id, 999);
      const res = await supertest({ userId: ta.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send({
          alertType: AlertType.REPHRASE_QUESTION,
          courseId: course.id,
          targetUserId: student.id,
          payload,
        })
        .expect(201);

      const body = res.body as CreateAlertResponse;
      expect(body.deliveryMode).toBe(AlertDeliveryMode.MODAL);

      const dbAlert = await AlertModel.findOneBy({ id: body.id });
      expect(dbAlert.deliveryMode).toBe(AlertDeliveryMode.MODAL);
    });

    it('rejects duplicate unread MODAL alerts (400) with no extra alert in DB', async () => {
      const payload = rephrasePayload(course.id, queue.id, 999);
      const body = {
        alertType: AlertType.REPHRASE_QUESTION,
        courseId: course.id,
        targetUserId: student.id,
        deliveryMode: AlertDeliveryMode.MODAL,
        payload,
      };

      await supertest({ userId: ta.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send(body)
        .expect(201);

      const countBefore = await countAlerts();

      const res = await supertest({ userId: ta.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send(body)
        .expect(400);

      expect(res.body.message).toBe(
        ERROR_MESSAGES.alertController.duplicateAlert,
      );

      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });

    it('rejects invalid payload type (400) with no alert created in DB', async () => {
      const countBefore = await countAlerts();

      const res = await supertest({ userId: ta.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send({
          alertType: AlertType.REPHRASE_QUESTION,
          courseId: course.id,
          targetUserId: student.id,
          deliveryMode: AlertDeliveryMode.MODAL,
          payload: { courseId: course.id, questionId: 1 }, // missing queueId
        })
        .expect(400);

      expect(res.body.message).toBe(
        ERROR_MESSAGES.alertController.incorrectPayload,
      );

      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });

    it('rejects invalid alertType for delivery mode (400) with no alert created', async () => {
      const countBefore = await countAlerts();

      // REPHRASE_QUESTION is not in FEED_ALERT_TYPES
      await supertest({ userId: ta.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send({
          alertType: AlertType.REPHRASE_QUESTION,
          courseId: course.id,
          targetUserId: student.id,
          deliveryMode: AlertDeliveryMode.FEED,
          payload: rephrasePayload(course.id, queue.id, 999),
        })
        .expect(400);

      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });

    it('student cannot create alerts (403)', async () => {
      const countBefore = await countAlerts();

      await supertest({ userId: student.id })
        .post(`/alerts/create-alert/${course.id}`)
        .send({
          alertType: AlertType.REPHRASE_QUESTION,
          courseId: course.id,
          targetUserId: otherUser.id,
          payload: rephrasePayload(course.id, queue.id, 999),
        })
        .expect(403);

      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ─── PATCH /alerts/:alertId (closeAlert) ───────────────────────────────────

  describe('PATCH /alerts/:alertId (closeAlert)', () => {
    it('marks an unread alert as read (200) and verifies DB', async () => {
      const alert = await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });

      const res = await supertest({ userId: student.id })
        .patch(`/alerts/${alert.id}`)
        .expect(200);

      const body = res.body as Alert;
      expect(body).toMatchObject({
        id: alert.id,
        readAt: expect.any(String),
      });

      const dbAlert = await AlertModel.findOneBy({ id: alert.id });
      expect(dbAlert.readAt).not.toBeNull();
    });

    it('already-read alert returns 202 with readAt unchanged', async () => {
      const originalReadAt = new Date('2025-01-01T00:00:00.000Z');
      const alert = await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: originalReadAt,
      });

      await supertest({ userId: student.id })
        .patch(`/alerts/${alert.id}`)
        .expect(202);

      const dbAlert = await AlertModel.findOneBy({ id: alert.id });
      expect(dbAlert.readAt.toISOString()).toBe(originalReadAt.toISOString());
    });

    it('alert belonging to another user returns 404 and is not modified', async () => {
      const alert = await AlertFactory.create({
        user: otherUser,
        course,
        deliveryMode: AlertDeliveryMode.MODAL,
        alertType: AlertType.REPHRASE_QUESTION,
        readAt: null,
      });

      const res = await supertest({ userId: student.id })
        .patch(`/alerts/${alert.id}`)
        .expect(404);

      expect(res.body.message).toBe(
        ERROR_MESSAGES.alertController.notActiveAlert,
      );

      const dbAlert = await AlertModel.findOneBy({ id: alert.id });
      expect(dbAlert.readAt).toBeNull();
    });

    it('non-existent alertId returns 404', async () => {
      await supertest({ userId: student.id })
        .patch('/alerts/99999')
        .expect(404);
    });
  });

  // ─── Admin Notice Endpoints ────────────────────────────────────────────────

  describe('POST /alerts/admin-notice', () => {
    it('creates admin notice for all users (no target)', async () => {
      const totalUsers = await UserModel.count();

      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload(),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      expect(body).toMatchObject({
        numSent: totalUsers,
        sentAt: expect.any(String),
      });

      const dbAlerts = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlerts).toHaveLength(totalUsers);
    });

    it('creates admin notice targeting a specific user', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { userId: student.id },
          }),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      expect(body.numSent).toBe(1);

      const dbAlerts = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].userId).toBe(student.id);
    });

    it('creates admin notice targeting a course', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.MODAL,
          payload: adminNoticePayload({
            target: { courseId: course.id },
          }),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      // student, ta, and otherUser are enrolled in course (from beforeEach)
      expect(body.numSent).toBe(3);

      const dbAlerts = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlerts).toHaveLength(3);
      const userIds = dbAlerts.map((a) => a.userId).sort();
      expect(userIds).toEqual([student.id, ta.id, otherUser.id].sort());
    });

    it('creates admin notice targeting a course with role filter', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { courseId: course.id, courseRole: Role.TA },
          }),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      expect(body.numSent).toBe(1); // only ta

      const dbAlerts = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlerts).toHaveLength(1);
      expect(dbAlerts[0].userId).toBe(ta.id);
    });

    it('creates admin notice targeting an organization', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { orgId: org.id },
          }),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      // All 4 users are in org (student, ta, adminUser, otherUser)
      expect(body.numSent).toBe(4);
    });

    it('overrides creatorName and creatorId from authenticated user', async () => {
      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { userId: student.id },
            creatorName: 'EVIL_HACKER',
            creatorId: 9999,
          }),
        })
        .expect(201);

      const dbAlert = await AlertModel.findOne({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      // Re-query admin from DB since `name` is a generated column
      const dbAdmin = await UserModel.findOneBy({ id: adminUser.id });
      const payload = dbAlert.payload as AdminNoticePayload;
      expect(payload).toMatchObject({
        creatorName: dbAdmin.name,
        creatorId: adminUser.id,
      });
      expect(payload.creatorName).not.toBe('EVIL_HACKER');
    });

    it('creates toast admin notice', async () => {
      const res = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.TOAST,
          payload: adminNoticeToastPayload({
            target: { userId: student.id },
          }),
        })
        .expect(201);

      const body = res.body as CreateAlertAdminResponse;
      expect(body.numSent).toBe(1);

      const dbAlert = await AlertModel.findOne({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlert.deliveryMode).toBe(AlertDeliveryMode.TOAST);
    });

    it('throws 404 when invalid userId target is provided', async () => {
      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { userId: 99999 },
          }),
        })
        .expect(404);

      const dbAlerts = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(dbAlerts).toHaveLength(0);
    });

    it('does NOT send email when ≤ 1000 users', async () => {
      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { userId: student.id },
          }),
        })
        .expect(201);

      expectEmailNotSent();
    });
  });

  describe('GET /alerts/admin-notice', () => {
    it('returns aggregated admin notice data grouped by sentAt', async () => {
      // Create an admin notice via the endpoint to get a real sentAt
      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { orgId: org.id },
          }),
        })
        .expect(201);

      const res = await supertest({ userId: adminUser.id })
        .get('/alerts/admin-notice')
        .expect(200);

      const body = res.body as GetAdminNoticeAlert[];
      expect(body).toHaveLength(1);

      // Re-query admin from DB since `name` is a generated column
      const dbAdmin = await UserModel.findOneBy({ id: adminUser.id });
      expect(body[0]).toMatchObject({
        totalSent: 4,
        totalRead: 0,
        title: 'Test Notice',
        message: 'This is a test admin notice',
        creatorName: dbAdmin.name,
        creatorId: adminUser.id,
        deliveryMode: AlertDeliveryMode.FEED,
      });
    });

    it('tracks totalRead correctly', async () => {
      // Create admin notice targeting 2 specific users
      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.MODAL,
          payload: adminNoticePayload({
            target: { orgId: org.id },
          }),
        })
        .expect(201);

      // Mark one user's alert as read
      const alertToRead = await AlertModel.findOne({
        where: { userId: student.id, alertType: AlertType.ADMIN_NOTICE },
      });
      alertToRead.readAt = new Date();
      await alertToRead.save();

      const res = await supertest({ userId: adminUser.id })
        .get('/alerts/admin-notice')
        .expect(200);

      const body = res.body as GetAdminNoticeAlert[];
      expect(body[0]).toMatchObject({
        totalSent: 4,
        totalRead: 1,
      });
    });
  });

  describe('DELETE /alerts/admin-notice', () => {
    it('deletes all alerts matching sentAt and verifies DB', async () => {
      const createRes = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { orgId: org.id },
          }),
        })
        .expect(201);

      const createBody = createRes.body as CreateAlertAdminResponse;
      const sentAt = createBody.sentAt;
      const countBefore = await countAlerts({
        alertType: AlertType.ADMIN_NOTICE,
      });
      expect(countBefore).toBe(4);

      const res = await supertest({ userId: adminUser.id })
        .delete(`/alerts/admin-notice?sentAt=${sentAt}`)
        .expect(200);

      const body = res.body as DeleteAdminNoticeResponse;
      expect(body).toEqual({ numDeleted: 4 });

      const countAfter = await countAlerts({
        alertType: AlertType.ADMIN_NOTICE,
      });
      expect(countAfter).toBe(0);
    });

    it('returns numDeleted 0 when no match and verifies no side effects', async () => {
      // Create an alert that should NOT be deleted
      await AlertFactory.create({
        user: student,
        course,
        deliveryMode: AlertDeliveryMode.FEED,
        alertType: AlertType.ASYNC_QUESTION_UPDATE,
      });

      const countBefore = await countAlerts();

      const res = await supertest({ userId: adminUser.id })
        .delete('/alerts/admin-notice?sentAt=2000-01-01T00:00:00.000Z')
        .expect(200);

      const body = res.body as DeleteAdminNoticeResponse;
      expect(body).toEqual({ numDeleted: 0 });

      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });

    it('only deletes alerts with matching sentAt, not other admin notices', async () => {
      // Create two separate admin notices at different times
      const create1 = await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            target: { userId: student.id },
          }),
        })
        .expect(201);

      const create1Body = create1.body as CreateAlertAdminResponse;

      // Wait a tiny bit so sentAt differs
      await new Promise((r) => setTimeout(r, 50));

      await supertest({ userId: adminUser.id })
        .post('/alerts/admin-notice')
        .send({
          deliveryMode: AlertDeliveryMode.FEED,
          payload: adminNoticePayload({
            message: 'Second notice',
            target: { userId: student.id },
          }),
        })
        .expect(201);

      expect(await countAlerts({ alertType: AlertType.ADMIN_NOTICE })).toBe(2);

      // Delete only the first one
      await supertest({ userId: adminUser.id })
        .delete(`/alerts/admin-notice?sentAt=${create1Body.sentAt}`)
        .expect(200);

      const remaining = await AlertModel.find({
        where: { alertType: AlertType.ADMIN_NOTICE },
      });
      expect(remaining).toHaveLength(1);
      const payload = remaining[0].payload as AdminNoticePayload;
      expect(payload.message).toBe('Second notice');
    });
  });

  // ─── Admin Notice Authorization Checks ─────────────────────────────────────

  describe('Admin Notice Authorization', () => {
    it.each([
      {
        desc: 'POST /alerts/admin-notice',
        action: (userId: number) =>
          supertest({ userId }).post('/alerts/admin-notice').send({
            deliveryMode: AlertDeliveryMode.FEED,
            payload: adminNoticePayload(),
          }),
      },
      {
        desc: 'GET /alerts/admin-notice',
        action: (userId: number) =>
          supertest({ userId }).get('/alerts/admin-notice'),
      },
      {
        desc: 'DELETE /alerts/admin-notice',
        action: (userId: number) =>
          supertest({ userId }).delete(
            '/alerts/admin-notice?sentAt=2000-01-01T00:00:00.000Z',
          ),
      },
    ])('$desc returns 403 for non-admin user', async ({ action }) => {
      const countBefore = await countAlerts();
      await action(ta.id).expect(403);
      const countAfter = await countAlerts();
      expect(countAfter).toBe(countBefore);
    });
  });
});
