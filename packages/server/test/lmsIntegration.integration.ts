import { OrganizationRole, Role, LMSResourceType } from '@koh/common';
import {
  CourseFactory,
  lmsCourseIntFactory,
  lmsOrgIntFactory,
  OrganizationFactory,
  UserFactory,
} from './util/factories';
import { UserCourseModel } from '../src/profile/user-course.entity';
import {
  failedPermsCheckForCourse,
  setupIntegrationTest,
} from './util/testUtils';
import { LmsIntegrationModule } from '../src/lmsIntegration/lmsIntegration.module';
import { OrganizationUserModel } from '../src/organization/organization-user.entity';
import { CourseModel } from '../src/course/course.entity';
import { UserModel } from '../src/profile/user.entity';

describe('Lms Integration Integrations', () => {
  const { supertest } = setupIntegrationTest(LmsIntegrationModule);

  let prof: UserModel;
  let course: CourseModel;

  beforeEach(async () => {
    prof = await UserFactory.create();
    course = await CourseFactory.create();

    await UserCourseModel.create({
      userId: prof.id,
      courseId: course.id,
      role: Role.PROFESSOR,
    }).save();
  });

  describe('GET lms/org/:oid/*', () => {
    it.each([OrganizationRole.PROFESSOR, OrganizationRole.MEMBER])(
      'should return 403 when org non-administrator calls route',
      async (orgRole: OrganizationRole) => {
        const user = await UserFactory.create();
        const organization = await OrganizationFactory.create();

        await OrganizationUserModel.create({
          userId: user.id,
          organizationId: organization.id,
          role: orgRole,
        }).save();

        const res = await supertest({ userId: user.id }).get(
          `/lms/org/${organization.id}`,
        );

        expect(res.status).toBe(403);
      },
    );
  });

  describe('GET /lms/:courseId/*', () => {
    it.each([
      { role: Role.STUDENT, route: '' },
      { role: Role.STUDENT, route: '/students' },
      { role: Role.STUDENT, route: '/assignments' },
      { role: Role.TA, route: '' },
      { role: Role.TA, route: '/students' },
      { role: Role.TA, route: '/assignments' },
    ])(
      'should return 403 when non-professor accesses route',
      async ({ role, route }) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}${route}`,
          role,
          'GET',
          supertest,
        );
      },
    );
  });

  describe('POST /lms/:courseId/test', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/test`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );
  });

  describe('GET lms/course/:id', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}`,
          courseRole,
          'GET',
          supertest,
        );
      },
    );
  });

  describe('POST lms/course/:id/upsert', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}/upsert`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );
  });

  describe('DELETE lms/course/:id/remove', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/course/${id}/remove`,
          courseRole,
          'DELETE',
          supertest,
        );
      },
    );
  });

  describe('POST lms/course/:id/sync', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).post(
        `/lms/${course.id}/sync`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST lms/course/:id/sync/force', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/force`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).post(
        `/lms/${course.id}/sync/force`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE lms/:id/sync/clear', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/clear`,
          courseRole,
          'DELETE',
          supertest,
        );
      },
    );

    it('should return 200 when LMS course integration exists', async () => {
      const orgInt = await lmsOrgIntFactory.create();
      await lmsCourseIntFactory.create({
        orgIntegration: orgInt,
        course: course,
      });

      const res = await supertest({ userId: prof.id }).delete(
        `/lms/${course.id}/sync/clear`,
      );
      expect(res.statusCode).toBe(200);
    });

    it('should return 404 when LMS course integration doesnt exist', async () => {
      const res = await supertest({ userId: prof.id }).delete(
        `/lms/${course.id}/sync/clear`,
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST lms/:id/sync/*/:id/toggle', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/announcement/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/assignment/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/page/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );

    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        await failedPermsCheckForCourse(
          (id) => `/lms/${id}/sync/file/0/toggle`,
          courseRole,
          'POST',
          supertest,
        );
      },
    );
  });

  describe('Quiz endpoints resource protection', () => {
    let integration;

    beforeEach(async () => {
      const orgInt = await lmsOrgIntFactory.create();
      integration = await lmsCourseIntFactory.create({
        orgIntegration: orgInt,
        course: course,
        // Set up integration without quiz resource enabled
        selectedResourceTypes: [
          LMSResourceType.ASSIGNMENTS,
          LMSResourceType.ANNOUNCEMENTS,
          LMSResourceType.PAGES,
        ],
      });
    });

    describe('GET /lms/:courseId/quiz/:quizId/preview/:accessLevel', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id }).get(
          `/lms/${course.id}/quiz/1/preview/logistics_only`,
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });

    describe('POST /lms/:courseId/quizzes/bulk-sync', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id })
          .post(`/lms/${course.id}/quizzes/bulk-sync`)
          .send({ action: 'enable', quizIds: [1] });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });

    describe('POST /lms/:courseId/quiz/:quizId/access-level', () => {
      it('should return 400 when quiz resource is disabled', async () => {
        const res = await supertest({ userId: prof.id })
          .post(`/lms/${course.id}/quiz/1/access-level`)
          .send({ accessLevel: 'logistics_only' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('resource type');
      });
    });
  });
});
