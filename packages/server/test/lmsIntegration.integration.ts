import { Role } from '@koh/common';
import { CourseFactory, UserFactory } from './util/factories';
import { UserCourseModel } from '../src/profile/user-course.entity';
import { setupIntegrationTest } from './util/testUtils';
import { LmsIntegrationModule } from '../src/lmsIntegration/lmsIntegration.module';

describe('Lms Integration Integrations', () => {
  const supertest = setupIntegrationTest(LmsIntegrationModule);

  describe('GET /lms_integration/:courseId/*', () => {
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
          `/lms_integration/${course.id}${route}`,
        );
        expect(res.statusCode).toBe(403);
      },
    );
  });

  describe('POST /lms_integration/:courseId/test', () => {
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
          `/lms_integration/${course.id}/test`,
        );

        expect(res.statusCode).toBe(403);
      },
    );
  });
});
