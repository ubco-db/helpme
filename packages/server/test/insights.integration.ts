import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  dashboardPresetFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { InsightsModule } from '../src/insights/insights.module';
import { Role } from '@koh/common';

describe('Insights Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(InsightsModule);

  describe('GET /insights/:courseId/:insightName', () => {
    it('returns ValueOutput for value insight', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const ucf = await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/${course.id}/TotalQuestionsAsked?limit=0&offset=0`)
        .expect(200);

      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('output');
    });

    it('returns TableOutput for table insight', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const ucf = await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/${course.id}/MostActiveStudents?limit=0&offset=0`)
        .expect(200);

      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('output');
      expect(res.body.output).toHaveProperty('data');
      expect(res.body.output.data).toBeInstanceOf(Array);
      expect(res.body.output).toHaveProperty('headerRow');
      expect(res.body.output.headerRow).toBeInstanceOf(Array);
    });

    it('returns ChartOutput for chart insight', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const ucf = await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });

      const res = await supertest({ userId: ucf.userId })
        .get(
          `/insights/${ucf.course.id}/AverageTimesByWeekDay?limit=0&offset=0`,
        )
        .expect(200);

      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('description');
      expect(res.body).toHaveProperty('output');
      expect(res.body.output).toHaveProperty('data');
      expect(res.body.output.data).toBeInstanceOf(Array);
      expect(res.body.output).toHaveProperty('xKey');
      expect(res.body.output).toHaveProperty('yKeys');
      expect(res.body.output.yKeys).toBeInstanceOf(Array);
    });

    it('returns an error when the user does not have the correct role', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.STUDENT });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/${ucf.courseId}/TotalQuestionsAsked?limit=0&offset=0`)
        .expect(400);
      expect(res.body.message).toEqual(
        'User is not authorized to view this insight',
      );
    });

    it('returns an error when the insight name is not found', async () => {
      const course = await CourseFactory.create();
      const ucf = await UserCourseFactory.create({
        role: Role.PROFESSOR,
        courseId: course.id,
      });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/${ucf.courseId}/AlamoInsight?limit=0&offset=0`)
        .expect(400);
      expect(res.body.message).toEqual('The insight requested was not found');
    });
  });

  describe('GET /insights/list', () => {
    it('should return list of insights', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.PROFESSOR });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/list`)
        .expect(200);

      expect(res.body).toMatchSnapshot();
    });
  });

  describe('DELETE /insights/:courseId/dashboard/remove', () => {
    it('should delete matching dashboard and return list', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.PROFESSOR });

      await dashboardPresetFactory.create({
        name: 'Preset #1',
        insights: {},
        userCourse: ucf,
      });
      await dashboardPresetFactory.create({
        name: 'Preset #2',
        insights: {},
        userCourse: ucf,
      });
      await dashboardPresetFactory.create({
        name: 'Preset #3',
        insights: {},
        userCourse: ucf,
      });

      const res = await supertest({ userId: ucf.userId })
        .delete(`/insights/${ucf.courseId}/dashboard/remove`)
        .send({ name: 'Preset #1' })
        .expect(200);

      expect(res.body).toMatchSnapshot();
    });
  });

  describe('POST /insights/:courseId/dashboard/create', () => {
    it('should create new dashboard and return list', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.PROFESSOR });

      const res = await supertest({ userId: ucf.userId })
        .post(`/insights/${ucf.courseId}/dashboard/create`)
        .send({ insights: { example: 'example' }, name: 'Preset #1' })
        .expect(201);

      expect(res.body).toMatchSnapshot();
    });

    it('should update matching dashboard and return list', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.PROFESSOR });

      await dashboardPresetFactory.create({
        name: 'Preset #1',
        insights: {},
        userCourse: ucf,
      });

      const res = await supertest({ userId: ucf.userId })
        .post(`/insights/${ucf.courseId}/dashboard/create`)
        .send({ insights: { example: 'example' }, name: 'Preset #1' })
        .expect(201);

      expect(res.body).toMatchSnapshot();
    });

    it('should fail if user is not professor', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.STUDENT });

      await supertest({ userId: ucf.userId })
        .post(`/insights/${ucf.courseId}/dashboard/create`)
        .send({ insights: { example: 'example' }, name: 'Preset #1' })
        .expect(400);
    });
  });

  describe('GET /insights/:courseId/dashboard', () => {
    it('should return list', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.PROFESSOR });

      await dashboardPresetFactory.create({
        name: 'Preset #1',
        insights: {},
        userCourse: ucf,
      });

      const res = await supertest({ userId: ucf.userId })
        .get(`/insights/${ucf.courseId}/dashboard`)
        .expect(200);

      expect(res.body).toMatchSnapshot();
    });

    it('should fail if user is not professor', async () => {
      const ucf = await UserCourseFactory.create({ role: Role.STUDENT });

      await supertest({ userId: ucf.userId })
        .get(`/insights/${ucf.courseId}/dashboard`)
        .expect(400);
    });
  });
});
