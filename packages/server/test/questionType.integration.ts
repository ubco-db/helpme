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
import { QuestionTypeModel } from '../src/questionType/question-type.entity';
import { QueueModel } from '../src/queue/queue.entity';
import { ERROR_MESSAGES } from '@koh/common';
import { IsNull } from 'typeorm';

describe('QuestionType Integration', () => {
  const { supertest } = setupIntegrationTest(QuestionTypeModule);
  const exampleConfig = {
    fifo_queue_view_enabled: true,
    tag_groups_queue_view_enabled: true,
    default_view: 'fifo' as const,
    minimum_tags: 1,
    tags: {
      tag1: {
        display_name: 'General',
        color_hex: '#66FF66',
      },
      tag2: {
        display_name: 'Bugs',
        color_hex: '#66AA66',
      },
      tag3: {
        display_name: 'Blocking',
        color_hex: '#FF0000',
      },
    },
    assignment_id: 'lab1',
    tasks: {
      task1: {
        display_name: 'Task 1',
        short_display_name: '1',
        blocking: false,
        color_hex: '#ffedb8',
        precondition: null,
      },
      task2: {
        display_name: 'Task 2',
        short_display_name: '2',
        blocking: false,
        color_hex: '#fadf8e',
        precondition: 'task1',
      },
      task3: {
        display_name: 'Task 3',
        short_display_name: '3',
        blocking: true,
        color_hex: '#f7ce52',
        precondition: 'task2',
      },
    },
  };

  // function to ensure a question type is unchanged
  const expectQuestionTypeUnchanged = async (
    questionType: QuestionTypeModel,
  ) => {
    const unchangedQuestionType = await QuestionTypeModel.findOne({
      where: {
        id: questionType.id,
      },
    });
    expect(unchangedQuestionType).not.toBeNull();
    expect(unchangedQuestionType.name).toBe(questionType.name);
    expect(unchangedQuestionType.color).toBe(questionType.color);
  };

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

    it('should return all non-queue question types for the course if queueId is not a number', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queueId: null,
        queue: null,
        name: 'Question Type 1',
        color: '#000000',
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queueId: null,
        queue: null,
        name: 'Question Type 2',
        color: '#ff0000',
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queueId: null,
        queue: null,
        name: 'Question Type 3',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: ta.id }).get(
        `/questionType/${course.id}/nan`,
      );
      expect(resp.text).not.toBe('No Question Types Found');
      expect(resp.status).toBe(200);
      expect(resp.body.length).toBe(3);
      expect(resp.body[0].name).toBe(qt1.name);
      expect(resp.body[1].name).toBe(qt2.name);
      expect(resp.body[2].name).toBe(qt3.name);
      expect(resp.body[0].color).toBe(qt1.color);
      expect(resp.body[1].color).toBe(qt2.color);
      expect(resp.body[2].color).toBe(qt3.color);
    });

    it('should return 404 if no question types are found', async () => {
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

      const resp = await supertest({ userId: student.id }).get(
        `/questionType/${course.id}/${queue.id}`,
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

    it('should return 409 if question type already exists', async () => {
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

      expect(resp.status).toBe(409);
      expect(resp.text).toBe(`${newQuestionType.name} already exists`);
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
      expect(resp.text).toBe(`Successfully created ${newQuestionType.name}`);

      const questionType = await QuestionTypeModel.findOne({
        where: {
          cid: course.id,
          queueId: newQuestionType.queueId,
          name: newQuestionType.name,
        },
      });
      expect(questionType).not.toBeNull();
      expect(questionType.name).toBe(newQuestionType.name);
      expect(questionType.color).toBe(newQuestionType.color);
    });

    it('should return 404 if the course does not exist', async () => {
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

      expect(resp.status).toBe(404);
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
      expect(resp.text).toBe(`Successfully created ${newQuestionType.name}`);

      const questionType = await QuestionTypeModel.findOne({
        where: {
          cid: course.id,
          queueId: IsNull(),
          name: newQuestionType.name,
        },
      });
      expect(questionType).not.toBeNull();
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

    it('should update the queue config with the new question types (aka tags)', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: exampleConfig,
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
      expect(resp.text).toBe(`Successfully created ${newQuestionType.name}`);

      const updatedQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });
      const generatedTagId = Object.keys(updatedQueue.config.tags).find(
        (tagId) => tagId.startsWith('New Question Type_'),
      );
      expect(generatedTagId).not.toBeUndefined();

      expect(updatedQueue.config).toEqual({
        ...exampleConfig,
        tags: {
          ...exampleConfig.tags,
          [generatedTagId]: {
            display_name: newQuestionType.name,
            color_hex: newQuestionType.color,
          },
        },
      });
    });

    it('should update the queue config even if no tags are in the config yet', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: null,
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
      expect(resp.text).toBe(`Successfully created ${newQuestionType.name}`);

      const updatedQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });
      const generatedTagId = Object.keys(updatedQueue.config.tags).find(
        (tagId) => tagId.startsWith('New Question Type_'),
      );
      expect(generatedTagId).not.toBeUndefined();
      expect(updatedQueue.config).toEqual({
        tags: {
          [generatedTagId]: {
            display_name: newQuestionType.name,
            color_hex: newQuestionType.color,
          },
        },
      });
    });

    it('should remove special characters from the question type name when creating the tag id', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: exampleConfig,
      });
      const newQuestionType = {
        queueId: queue.id,
        name: 'New{:},Question Type',
        color: '#FFFFFF',
      };

      const resp = await supertest({ userId: ta.id })
        .post(`/questionType/${course.id}`)
        .send(newQuestionType);

      expect(resp.status).toBe(200);
      expect(resp.text).toBe(`Successfully created ${newQuestionType.name}`);

      const updatedQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });
      const generatedTagId = Object.keys(updatedQueue.config.tags).find(
        (tagId) => tagId.startsWith('NewQuestion Type_'),
      );
      expect(generatedTagId).not.toBeUndefined();

      expect(updatedQueue.config).toEqual({
        ...exampleConfig,
        tags: {
          ...exampleConfig.tags,
          [generatedTagId]: {
            display_name: newQuestionType.name,
            color_hex: newQuestionType.color,
          },
        },
      });
    });
  });

  describe('DELETE /questionType/:courseId/:questionTypeId', () => {
    it('should return 401 if user is not authorized', async () => {
      const course = await CourseFactory.create();
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      });

      await supertest()
        .delete(`/questionType/${course.id}/${questionType.id}`)
        .expect(401);
      await expectQuestionTypeUnchanged(questionType);
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
      expect(resp.text).toBe(`Successfully deleted ${questionType.name}`);

      const deletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(deletedQuestionType).toBeNull();
    });

    it('should return 404 if the question type does not exist', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const resp = await supertest({ userId: ta.id }).delete(
        `/questionType/${course.id}/999`,
      );

      expect(resp.status).toBe(404);
      expect(resp.text).toBe('Question Type not found');
    });

    it('should return 404 if the course does not exist', async () => {
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
        `/questionType/999/${questionType.id}`,
      );

      expect(resp.status).toBe(404);
      await expectQuestionTypeUnchanged(questionType);
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
      await expectQuestionTypeUnchanged(questionType);
    });

    it('should update the queue config and delete the tag', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: exampleConfig,
      });
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: 'General',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: ta.id }).delete(
        `/questionType/${course.id}/${questionType.id}`,
      );

      expect(resp.status).toBe(200);
      expect(resp.text).toBe(`Successfully deleted ${questionType.name}`);

      const deletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(deletedQuestionType).toBeNull();

      const updatedQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });
      expect(updatedQueue.config).toEqual({
        ...exampleConfig,
        tags: {
          tag2: exampleConfig.tags.tag2,
          tag3: exampleConfig.tags.tag3,
        },
      });
    });

    it('should still update the queue config even if the config does not have tags', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: null,
      });
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: 'General',
        color: '#FFFFFF',
      });

      const resp = await supertest({ userId: ta.id }).delete(
        `/questionType/${course.id}/${questionType.id}`,
      );

      expect(resp.status).toBe(200);
      expect(resp.text).toBe(`Successfully deleted ${questionType.name}`);

      const deletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(deletedQuestionType).toBeNull();

      const updatedQueue = await QueueModel.findOne({
        where: {
          id: queue.id,
        },
      });
      expect(updatedQueue.config).toEqual({
        tags: {},
      });
    });

    it('soft deletes the question type', async () => {
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
      expect(resp.text).toBe(`Successfully deleted ${questionType.name}`);

      const deletedQuestionType = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
        withDeleted: true,
      });
      expect(deletedQuestionType).not.toBeNull();
      expect(deletedQuestionType.deletedAt).not.toBeUndefined();
    });
  });

  describe('PATCH /questionType/:courseId/:questionTypeId', () => {
    it('should return 401 if user is not authorized', async () => {
      const course = await CourseFactory.create();
      const questionType = await QuestionTypeFactory.create({
        cid: course.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      });
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#FFFFFF',
      };

      await supertest()
        .patch(`/questionType/${course.id}/${questionType.id}`)
        .send(updatedQuestionType)
        .expect(401);

      await expectQuestionTypeUnchanged(questionType);
    });

    it('should return 200 and update the question type if it exists', async () => {
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
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#000000',
      };

      const resp = await supertest({ userId: ta.id })
        .patch(`/questionType/${course.id}/${questionType.id}`)
        .send(updatedQuestionType);

      expect(resp.status).toBe(200);
      expect(resp.text).toBe(
        `Successfully edited ${questionType.name} (${updatedQuestionType.name})`,
      );

      const updatedQuestionTypeModel = await QuestionTypeModel.findOne({
        where: {
          id: questionType.id,
          cid: course.id,
        },
      });
      expect(updatedQuestionTypeModel).not.toBeNull();
      expect(updatedQuestionTypeModel.name).toBe(updatedQuestionType.name);
      expect(updatedQuestionTypeModel.color).toBe(updatedQuestionType.color);
    });

    it('should return 404 if the course does not exist', async () => {
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
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#000000',
      };

      const resp = await supertest({ userId: ta.id })
        .patch(`/questionType/999/${questionType.id}`)
        .send(updatedQuestionType);

      expect(resp.status).toBe(404);
      await expectQuestionTypeUnchanged(questionType);
    });

    it('should not allow students to update question types', async () => {
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
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#000000',
      };

      const resp = await supertest({ userId: student.id })
        .patch(`/questionType/${course.id}/${questionType.id}`)
        .send(updatedQuestionType);

      expect(resp.status).toBe(403);
      await expectQuestionTypeUnchanged(questionType);
    });

    it('should return 404 if the question type does not exist', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#000000',
      };

      const resp = await supertest({ userId: ta.id })
        .patch(`/questionType/${course.id}/999`)
        .send(updatedQuestionType);

      expect(resp.text).toBe(ERROR_MESSAGES.questionType.questionTypeNotFound);
      expect(resp.statusCode).toBe(404);
    });

    it('does not allow professors to update question types in other courses', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course1,
        user: await UserFactory.create(),
      });
      const questionType = await QuestionTypeFactory.create({
        cid: course1.id,
        name: 'Existing Question Type',
        color: '#FFFFFF',
      });
      const updatedQuestionType = {
        name: 'Updated Question Type',
        color: '#000000',
      };

      const resp = await supertest({ userId: ta.id })
        .patch(`/questionType/${course2.id}/${questionType.id}`)
        .send(updatedQuestionType);

      expect(resp.status).toBe(404);
      await expectQuestionTypeUnchanged(questionType);
    });
  });
});
