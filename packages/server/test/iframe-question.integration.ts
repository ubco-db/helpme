import { IframeQuestionModule } from '../src/iframe-question/iframe-question.module';
import { IframeQuestionModel } from '../src/iframe-question/iframe-question.entity';
import {
  CourseFactory,
  IframeQuestionFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';

describe('IframeQuestion Integration', () => {
  const { supertest } = setupIntegrationTest(IframeQuestionModule);

  describe('POST /iframe-question/:courseId', () => {
    it('returns 401 when not logged in', async () => {
      await supertest().post('/iframe-question/1').expect(401);
    });

    it('creates a question with text and criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      const res = await supertest({ userId: ta.userId })
        .post(`/iframe-question/${course.id}`)
        .send({
          questionText: 'What did you learn?',
          criteriaText: 'Be specific',
        })
        .expect(201);

      expect(res.body.questionText).toEqual('What did you learn?');
      expect(res.body.criteriaText).toEqual('Be specific');
      expect(res.body.courseId).toEqual(course.id);
    });

    it('returns 400 when creating without criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/iframe-question/${course.id}`)
        .send({ questionText: 'No criteria' })
        .expect(400);
    });
  });

  describe('GET /iframe-question/:courseId', () => {
    it('returns 403 when a student tries to list questions', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/iframe-question/${course.id}`)
        .expect(403);
    });

    it('returns all questions for a course', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await IframeQuestionFactory.create({ course, questionText: 'Q1' });
      await IframeQuestionFactory.create({ course, questionText: 'Q2' });

      const res = await supertest({ userId: ta.userId })
        .get(`/iframe-question/${course.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('does not return questions from other courses', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course1,
        user: await UserFactory.create(),
      });

      await IframeQuestionFactory.create({
        course: course1,
        questionText: 'Mine',
      });
      await IframeQuestionFactory.create({
        course: course2,
        questionText: 'Not mine',
      });

      const res = await supertest({ userId: ta.userId })
        .get(`/iframe-question/${course1.id}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].questionText).toEqual('Mine');
    });
  });

  describe('GET /iframe-question/:courseId/:questionId', () => {
    it('allows a student to fetch a single question', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({
        course,
        questionText: 'Student visible',
      });

      const res = await supertest({ userId: student.userId })
        .get(`/iframe-question/${course.id}/${question.id}`)
        .expect(200);

      expect(res.body.questionText).toEqual('Student visible');
    });

    it('returns 404 for a nonexistent question', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/iframe-question/${course.id}/999`)
        .expect(404);
    });

    it('returns 404 when question belongs to a different course', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course: course1,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({ course: course2 });

      await supertest({ userId: student.userId })
        .get(`/iframe-question/${course1.id}/${question.id}`)
        .expect(404);
    });
  });

  describe('GET /iframe-question/public/:courseId/:questionId', () => {
    it('allows unauthenticated users to fetch a single question', async () => {
      const course = await CourseFactory.create();
      const question = await IframeQuestionFactory.create({
        course,
        questionText: 'Public question',
      });

      const res = await supertest()
        .get(`/iframe-question/public/${course.id}/${question.id}`)
        .expect(200);

      expect(res.body.questionText).toEqual('Public question');
    });

    it('returns 404 for a nonexistent public question', async () => {
      const course = await CourseFactory.create();

      await supertest()
        .get(`/iframe-question/public/${course.id}/999`)
        .expect(404);
    });
  });

  describe('POST /iframe-question/public/:courseId/:questionId/feedback', () => {
    it('returns 400 when responseText is missing', async () => {
      const course = await CourseFactory.create();
      const question = await IframeQuestionFactory.create({ course });

      await supertest()
        .post(`/iframe-question/public/${course.id}/${question.id}/feedback`)
        .send({})
        .expect(400);
    });

    it('returns 400 when responseText is not a string', async () => {
      const course = await CourseFactory.create();
      const question = await IframeQuestionFactory.create({ course });

      await supertest()
        .post(`/iframe-question/public/${course.id}/${question.id}/feedback`)
        .send({ responseText: 123 })
        .expect(400);
    });

    it('returns 400 when responseText is only whitespace', async () => {
      const course = await CourseFactory.create();
      const question = await IframeQuestionFactory.create({ course });

      await supertest()
        .post(`/iframe-question/public/${course.id}/${question.id}/feedback`)
        .send({ responseText: '   ' })
        .expect(400);
    });
  });

  describe('PATCH /iframe-question/:courseId/:questionId', () => {
    it('returns 403 when a student tries to update', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({ course });

      await supertest({ userId: student.userId })
        .patch(`/iframe-question/${course.id}/${question.id}`)
        .send({ questionText: 'Nope', criteriaText: 'Nope' })
        .expect(403);
    });

    it('updates a question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({
        course,
        questionText: 'Original',
      });

      const res = await supertest({ userId: ta.userId })
        .patch(`/iframe-question/${course.id}/${question.id}`)
        .send({ questionText: 'Updated', criteriaText: 'Updated criteria' })
        .expect(200);

      expect(res.body.questionText).toEqual('Updated');
      expect(res.body.criteriaText).toEqual('Updated criteria');
    });

    it('returns 400 when updating without criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({
        course,
        questionText: 'Original',
      });

      await supertest({ userId: ta.userId })
        .patch(`/iframe-question/${course.id}/${question.id}`)
        .send({ questionText: 'Updated' })
        .expect(400);
    });
  });

  describe('DELETE /iframe-question/:courseId/:questionId', () => {
    it('returns 403 when a student tries to delete', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({ course });

      await supertest({ userId: student.userId })
        .delete(`/iframe-question/${course.id}/${question.id}`)
        .expect(403);
    });

    it('deletes a question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await IframeQuestionFactory.create({ course });

      await supertest({ userId: ta.userId })
        .delete(`/iframe-question/${course.id}/${question.id}`)
        .expect(200);

      const deleted = await IframeQuestionModel.findOne({
        where: { id: question.id },
      });
      expect(deleted).toBeNull();
    });

    it('returns 404 for a nonexistent question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .delete(`/iframe-question/${course.id}/999`)
        .expect(404);
    });
  });
});
