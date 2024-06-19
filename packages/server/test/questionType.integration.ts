import { QuestionTypeModule } from 'questionType/questionType.module';
import {
  CourseFactory,
  UserFactory,
  QueueFactory,
  TACourseFactory,
  StudentCourseFactory,
  QuestionTypeFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { QuestionTypeModel } from 'questionType/question-type.entity';

describe('QuestionType Integration', () => {
  const supertest = setupIntegrationTest(QuestionTypeModule);
  describe('GET /questionType/:courseId/:queueId', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get(`/questionType/1/1`).expect(401);
    });

    it('should return 404 if invalid course', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const student = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      // invalid course
      const resp = await supertest({ userId: student.id }).get(
        `/questionType/999/${queue.id}`,
      );
      expect(resp.status).toBe(404);
    });

    it('should return 404 if invalid queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const student = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      // invalid queue
      const resp = await supertest({ userId: student.id }).get(
        `/questionType/${course.id}/999`,
      );
      expect(resp.status).toBe(404);
    });

    it('should return all the question types for a queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const student = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: 'Question Type 1',
        color: '#000000',
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: 'Question Type 2',
        color: '#ff0000',
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: 'Question Type 3',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: student.id }).get(
        `/questionType/${course.id}/${queue.id}`,
      );
      expect(resp.status).toBe(200);
      expect(resp.body.length).toBe(3);
      expect(resp.body[0].name).toBe(qt1.name);
      expect(resp.body[1].name).toBe(qt2.name);
      expect(resp.body[2].name).toBe(qt3.name);
      expect(resp.body[0].color).toBe(qt1.color);
      expect(resp.body[1].color).toBe(qt2.color);
      expect(resp.body[2].color).toBe(qt3.color);
    });
  });

  describe('POST /questionType/:courseId', () => {
    it('should return 401 if user is not authorized', async () => {
      const courseId = 1;
      const newQuestionType = {
        queueId: 1,
        name: 'New Question Type',
        color: '#FFFFFF',
      };

      await supertest()
        .post(`/questionType/${courseId}`)
        .send(newQuestionType)
        .expect(401);
    });

    it('should return 400 if question type already exists', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const newQuestionType = {
        queueId: queue.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      };
      await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: newQuestionType.name,
        color: newQuestionType.color,
      });

      const resp = await supertest({ userId: ta.id })
        .post(`/questionType/${course.id}`)
        .send(newQuestionType);

      expect(resp.status).toBe(400);
      expect(resp.text).toBe('Question type already exists');
    });

    it('should return 200 and create a new question type if it does not already exist', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const newQuestionType = {
        queueId: queue.id,
        name: 'New Question Type',
        color: '#FFFFFF',
      };

      const resp = await supertest({ userId: ta.id })
        .post(`/questionType/${course.id}`)
        .send(newQuestionType);

      expect(resp.status).toBe(200);
      expect(resp.text).toBe('success');

      const questionType = await QuestionTypeModel.findOne({
        where: {
          cid: course.id,
          queueId: newQuestionType.queueId,
          name: newQuestionType.name,
        },
      });
      expect(questionType).not.toBeUndefined();
      expect(questionType.name).toBe(newQuestionType.name);
      expect(questionType.color).toBe(newQuestionType.color);
    });

    it('should return 400 if the course does not exist', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const newQuestionType = {
        queueId: queue.id,
        name: 'New Question Type',
        color: '#FFFFFF',
      };

      const resp = await supertest({ userId: ta.id })
        .post(`/questionType/999`)
        .send(newQuestionType);

      expect(resp.status).toBe(400);
    });

    it('should create a new question type with null queueId is NaN (or is not given)', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const newQuestionType = {
        name: 'New Question Type',
        color: '#FFFFFF',
      };

      const resp = await supertest({ userId: ta.id })
        .post(`/questionType/${course.id}`)
        .send(newQuestionType);

      expect(resp.status).toBe(200);
      expect(resp.text).toBe('success');

      const questionType = await QuestionTypeModel.findOne({
        where: {
          cid: course.id,
          queueId: null,
          name: newQuestionType.name,
        },
      });
      expect(questionType).not.toBeUndefined();
      expect(questionType.name).toBe(newQuestionType.name);
      expect(questionType.color).toBe(newQuestionType.color);
    });

    it('should not allow students to create question types', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });
      const newQuestionType = {
        queueId: queue.id,
        name: 'New Question Type',
        color: '#FFFFFF',
      };

      const resp = await supertest({ userId: student.id })
        .post(`/questionType/${course.id}`)
        .send(newQuestionType);

      expect(resp.status).toBe(403);
    });
  });

  describe('DELETE /questionType/:courseId/:questionTypeId', () => {
    it('should return 401 if user is not authorized', async () => {
      const courseId = 1;
      const questionTypeId = 1;

      await supertest()
        .delete(`/questionType/${courseId}/${questionTypeId}`)
        .expect(401);
    });

    it('should return 200 and delete the question type if it exists', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: ta.id }).delete(
        `/questionType/${course.id}/${questionType.id}`,
      );

      expect(resp.status).toBe(200);
      expect(resp.text).toBe('success');

      const deletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(deletedQuestionType).toBeUndefined();
    });

    it('should return 200 even if the question type does not exist', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const resp = await supertest({ userId: ta.id }).delete(
        `/questionType/${course.id}/999`,
      );

      expect(resp.status).toBe(200);
      expect(resp.text).toBe('success');
    });

    it('should not allow students to delete question types', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: student.id }).delete(
        `/questionType/${course.id}/${questionType.id}`,
      );

      expect(resp.status).toBe(403);
      const notDeletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(notDeletedQuestionType).not.toBeUndefined();
    });
  });
});
