import { OrganizationRole, Role } from '@koh/common';
import {
  CourseFactory,
  OrganizationFactory,
  UserFactory,
} from './util/factories';
import { UserCourseModel } from '../src/profile/user-course.entity';
import { setupIntegrationTest } from './util/testUtils';
import { LmsIntegrationModule } from '../src/lmsIntegration/lmsIntegration.module';
import { OrganizationUserModel } from '../src/organization/organization-user.entity';

describe('Lms Integration Integrations', () => {
  const supertest = setupIntegrationTest(LmsIntegrationModule);

  describe('GET lms/org/:oid/*', () => {
    it.each([OrganizationRole.PROFESSOR, OrganizationRole.MEMBER])(
      'should return 401 when org non-administrator calls route',
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

        expect(res.status).toBe(401);
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
        const user = await UserFactory.create();
        const course = await CourseFactory.create();

        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: role,
        }).save();

        const res = await supertest({ userId: user.id }).get(
          `/lms/${course.id}${route}`,
        );
        expect(res.statusCode).toBe(403);
      },
    );
  });

  describe('POST /lms/:courseId/test', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        const user = await UserFactory.create();
        const course = await CourseFactory.create();

        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: courseRole,
        }).save();

        const res = await supertest({ userId: user.id }).post(
          `/lms/${course.id}/test`,
        );

        expect(res.statusCode).toBe(403);
      },
    );
  });

  describe('GET lms/course/:id', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        const user = await UserFactory.create();
        const course = await CourseFactory.create();

        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: courseRole,
        }).save();

        const res = await supertest({ userId: user.id }).get(
          `/lms/course/${course.id}`,
        );
        expect(res.statusCode).toBe(403);
      },
    );
  });

  describe('POST lms/course/:id/upsert', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        const user = await UserFactory.create();
        const course = await CourseFactory.create();

        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: courseRole,
        }).save();

        const res = await supertest({ userId: user.id }).post(
          `/lms/course/${course.id}/upsert`,
        );
        expect(res.statusCode).toBe(403);
      },
    );
  });

  describe('DELETE lms/course/:id/remove', () => {
    it.each([Role.STUDENT, Role.TA])(
      'should return 403 when non-professor accesses route',
      async (courseRole) => {
        const user = await UserFactory.create();
        const course = await CourseFactory.create();

        await UserCourseModel.create({
          userId: user.id,
          courseId: course.id,
          role: courseRole,
        }).save();

        const res = await supertest({ userId: user.id }).delete(
          `/lms/course/${course.id}/remove`,
        );
        expect(res.statusCode).toBe(403);
      },
    );
  });
});
