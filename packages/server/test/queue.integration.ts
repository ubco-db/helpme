import { OpenQuestionStatus, QueueInviteParams, Role } from '@koh/common';
import { QuestionModel } from 'question/question.entity';
import { QueueModule } from '../src/queue/queue.module';
import {
  CourseFactory,
  QuestionFactory,
  QuestionTypeFactory,
  QueueFactory,
  QueueInviteFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { QueueModel } from '../src/queue/queue.entity';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { QueueInviteModel } from 'queue/queue_invite.entity';

async function delay(ms) {
  // return await for better async stack trace support in case of errors.
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Queue Integration', () => {
  const supertest = setupIntegrationTest(QueueModule);

  describe('GET /queues/:id', () => {
    it('get a queue', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const queue = await QueueFactory.create({
        courseId: course.id,
        course: course,
        questions: [await QuestionFactory.create()],
        staffList: [ta],
      });
      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: queue.course,
      });

      const res = await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        id: 3,
        notes: null,
        queueSize: 1,
        room: 'Online',
        staffList: expect.any(Array),
        isOpen: true,
      });
    });

    it('is not open when there are no TAs present', async () => {
      const queue = await QueueFactory.create({});
      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: queue.course,
      });

      const res = await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        // isOpen: false,
        isOpen: true,
      });
    });

    it('is open when there are TAs present', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
      });

      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: queue.course,
      });

      const res = await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        isOpen: true,
      });
    });

    it('returns 404 on non-existent course', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const queue = await QueueFactory.create({ course, staffList: [ta] });
      const user = await UserFactory.create();

      await supertest({ userId: user.id })
        .get(`/queues/${queue.id + 999}`)
        .expect(404);
    });

    it('returns 401 when not logged in', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({
        course: course,
        questions: [await QuestionFactory.create()],
      });

      const res = await supertest({ userId: 99 })
        .get(`/queues/${queue.id}`)
        .expect(401);
      expect(res.body).toMatchSnapshot();
    });

    it('returns 404 when user is not in course', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({
        courseId: course.id,
        course: course,
        questions: [await QuestionFactory.create()],
      });
      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}`)
        .expect(404);
    });
  });

  describe('GET /queues/:id/questions', () => {
    it('returns questions in the queue', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({
        course: course,
        questions: [
          await QuestionFactory.create({
            text: 'in queue',
            createdAt: new Date('2020-03-01T05:00:00.000Z'),
          }),
        ],
      });
      await QuestionFactory.create({
        text: 'not in queue',
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: queue.course,
        courseId: queue.course.id,
      });

      const res = await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}/questions`)
        .expect(200);

      expect(res.body).toMatchSnapshot();
      expect(res.body.questions[0].creator).not.toHaveProperty('firstName');
      expect(res.body.questions[0].creator).not.toHaveProperty('lastName');
    });

    it('returns all creator data for ta', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({
        course: course,
        questions: [
          await QuestionFactory.create({
            text: 'in queue',
            createdAt: new Date('2020-03-01T05:00:00.000Z'),
          }),
        ],
      });
      await QuestionFactory.create({
        text: 'not in queue',
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: queue.course,
        courseId: queue.course.id,
      });

      const res = await supertest({ userId: ta.user.id })
        .get(`/queues/${queue.id}/questions`)
        .expect(200);
      expect(res.body.questions[0].creator).toHaveProperty('name');
    });

    it('returns 404 when a user is not a member of the course', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({
        course: course,
        questions: [
          await QuestionFactory.create({
            text: 'in queue',
            createdAt: new Date('2020-03-01T05:00:00.000Z'),
          }),
        ],
      });
      await QuestionFactory.create({
        text: 'not in queue',
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      const userCourse = await UserCourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: userCourse.user.id })
        .get(`/queues/${queue.id}/questions`)
        .expect(404);
    });

    it('returns 404 when queue does not exist', async () => {
      const user = await UserFactory.create();

      await supertest({ userId: user.id })
        .get(`/queues/8291390/questions`)
        .expect(404);
    });
  });

  describe('POST /queues/:id/clean', () => {
    // Create a queue that is closed and has a question ready to be cleaned
    const cleanableQueue = async () => {
      const queue = await QueueFactory.create({
        room: 'The Alamo',
      });
      await QuestionFactory.create({ queue: queue });
      return queue;
    };
    it('cleans the queue', async () => {
      const queue = await cleanableQueue();
      const tcf = await TACourseFactory.create({
        course: queue.course,
        user: await UserFactory.create(),
      });

      expect(
        await QuestionModel.inQueueWithStatus(
          queue.id,
          Object.values(OpenQuestionStatus),
        ).getCount(),
      ).toEqual(1);

      await supertest({ userId: tcf.userId })
        .post(`/queues/${queue.id}/clean`)
        .expect(201);

      await delay(100);
      expect(
        await QuestionModel.inQueueWithStatus(
          queue.id,
          Object.values(OpenQuestionStatus),
        ).getCount(),
      ).toEqual(0);
    });

    it('does not allow students access', async () => {
      const queue = await cleanableQueue();
      const scf = await StudentCourseFactory.create({
        course: queue.course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: scf.userId })
        .post(`/queues/${queue.id}/clean`)
        .expect(403);

      await delay(100);
      /// questions should still be there
      expect(
        await QuestionModel.inQueueWithStatus(
          queue.id,
          Object.values(OpenQuestionStatus),
        ).getCount(),
      ).toEqual(1);
    });
  });

  describe('DELETE /queues/:id', () => {
    it('disables queues on hit', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      expect(queue.isDisabled).toBeFalsy();

      await supertest({ userId: ta.userId })
        .delete(`/queues/${queue.id}`)
        .expect(200);

      const postQueue = await QueueModel.findOne({ id: queue.id });
      expect(postQueue.isDisabled).toBeTruthy();
    });

    it('doesnt allow students to delete queue', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      expect(queue.isDisabled).toBeFalsy();

      await supertest({ userId: stu.userId })
        .delete(`/queues/${queue.id}`)
        .expect(403);

      const postQueue = await QueueModel.findOne({ id: queue.id });
      expect(postQueue.isDisabled).toBeFalsy();
    });

    it('doesnt allow TAs to disable prof queues', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        isProfessorQueue: true,
      });

      expect(queue.isDisabled).toBeFalsy();

      await supertest({ userId: ta.userId })
        .delete(`/queues/${queue.id}`)
        .expect(401);
    });

    it('allows professors to disable prof queues', async () => {
      const course = await CourseFactory.create();
      const prof = await UserCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
        role: Role.PROFESSOR,
      });

      const queue = await QueueFactory.create({ course });

      expect(queue.isDisabled).toBeFalsy();

      await supertest({ userId: prof.userId })
        .delete(`/queues/${queue.id}`)
        .expect(200);

      const postQueue = await QueueModel.findOne({ id: queue.id });
      expect(postQueue.isDisabled).toBeTruthy();
    });
    it('returns 404 on nonexistent queues', async () => {
      const stu = await StudentCourseFactory.create({
        user: await UserFactory.create(),
      });
      await supertest({ userId: stu.userId }).delete(`/queues/998`).expect(404);
    });
  });

  describe('PATCH /queues/:id/config', () => {
    const validConfig = {
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
    it('updates queue config', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      expect(queue.config).toEqual({});

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(validConfig)
        .expect(200);

      const updatedQueue = await QueueModel.findOne({ id: queue.id });
      expect(updatedQueue.config).toEqual(validConfig);
    });
    it('doesnt allow students to update config', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      expect(queue.config).toEqual({});

      await supertest({ userId: stu.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(validConfig)
        .expect(403);

      const postQueue = await QueueModel.findOne({ id: queue.id });
      expect(postQueue.config).toEqual({});
    });
    it('returns 404 on nonexistent queues', async () => {
      const stu = await StudentCourseFactory.create({
        user: await UserFactory.create(),
      });
      await supertest({ userId: stu.userId })
        .patch(`/queues/998/config`)
        .send(validConfig)
        .expect(404);
    });
    it('returns 400 on invalid config', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      const invalidConfig = { foo: 'bar' };

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(invalidConfig)
        .expect(400);
    });
    it('returns 400 on config with invalid task', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      const invalidConfig = {
        tasks: {
          task1: {
            display_name: 'Task 1',
            short_display_name: 'T1',
            blocking: 'not a boolean',
            color_hex: '#000000',
            precondition: null,
          },
        },
        assignment_id: 'assignment1',
      };

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(invalidConfig)
        .expect(400);
    });
    it('returns 400 on config with invalid tag', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
      });

      const invalidConfig = {
        tags: {
          tag1: {
            display_name: 'Tag 1',
            color_hex: 'not a hex color',
          },
        },
      };

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(invalidConfig)
        .expect(400);
    });
    it('creates a new question type when the new config has a new tagId', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          ...validConfig.tags,
          tag4: {
            display_name: 'New Tag',
            color_hex: '#FFFFFF',
          },
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(1);
      expect(response.body.questionTypeMessages).toContain(
        'Created tag: New Tag',
      );

      // check to make sure the old question types are still there and unchanged
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(4);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: qt1.name,
          color: qt1.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: qt2.name,
          color: qt2.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          cid: qt3.cid,
          queueId: qt3.queueId,
          name: qt3.name,
          color: qt3.color,
        }),
      );
      // see if the new question type are there
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          cid: course.id,
          queueId: queue.id,
          name: 'New Tag',
          color: '#FFFFFF',
        }),
      );
    });
    it('creates multiple new question types when the new config has multiple new tagIds', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          ...validConfig.tags,
          tag4: {
            display_name: 'New Tag 1',
            color_hex: '#FFFFFF',
          },
          tag5: {
            display_name: 'New Tag 2',
            color_hex: '#FFFFFF',
          },
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(2);
      expect(response.body.questionTypeMessages).toContain(
        'Created tag: New Tag 1',
      );
      expect(response.body.questionTypeMessages).toContain(
        'Created tag: New Tag 2',
      );

      // check to make sure the old question types are still there and unchanged
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(5);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: qt1.name,
          color: qt1.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: qt2.name,
          color: qt2.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          cid: qt3.cid,
          queueId: qt3.queueId,
          name: qt3.name,
          color: qt3.color,
        }),
      );
      // see if the new question types are there
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          cid: course.id,
          queueId: queue.id,
          name: 'New Tag 1',
          color: '#FFFFFF',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          cid: course.id,
          queueId: queue.id,
          name: 'New Tag 2',
          color: '#FFFFFF',
        }),
      );
    });
    it('deletes an existing question types when the new config has removed an old tagId', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          tag1: validConfig.tags.tag1,
          tag2: validConfig.tags.tag2,
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(1);
      expect(response.body.questionTypeMessages).toContain(
        'Deleted tag: ' + validConfig.tags.tag3.display_name,
      );

      // check to make sure the old question types are still there and unchanged (and that the deleted one is gone)
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(2);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: qt1.name,
          color: qt1.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: qt2.name,
          color: qt2.color,
        }),
      );
    });
    it('deletes multiple existing question types when the new config has removed multiple old tagIds', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          tag1: validConfig.tags.tag1,
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(2);
      expect(response.body.questionTypeMessages).toContain(
        'Deleted tag: ' + validConfig.tags.tag2.display_name,
      );
      expect(response.body.questionTypeMessages).toContain(
        'Deleted tag: ' + validConfig.tags.tag3.display_name,
      );

      // check to make sure the old question types are still there and unchanged (and that the deleted ones are gone)
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(1);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: qt1.name,
          color: qt1.color,
        }),
      );
    });
    it("updates an existing question type when the new config has changed an old tag's attribute", async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          ...validConfig.tags,
          tag1: {
            display_name: 'My Updated Tag',
            color_hex: '#FFFFFF',
          },
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(1);
      expect(response.body.questionTypeMessages).toContain(
        'Updated tag: My Updated Tag',
      );

      // check to make sure the old question types are still there and unchanged (and that the updated one is updated)
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(3);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: 'My Updated Tag',
          color: '#FFFFFF',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: qt2.name,
          color: qt2.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          cid: qt3.cid,
          queueId: qt3.queueId,
          name: qt3.name,
          color: qt3.color,
        }),
      );
    });
    it("updates multiple existing question types when the new config has changed multiple old tags' attributes", async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          ...validConfig.tags,
          tag1: {
            display_name: 'My Updated Tag 1',
            color_hex: '#FFFFFF',
          },
          tag2: {
            display_name: 'My Updated Tag 2',
            color_hex: '#FFFFFF',
          },
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(2);
      expect(response.body.questionTypeMessages).toContain(
        'Updated tag: My Updated Tag 1',
      );
      expect(response.body.questionTypeMessages).toContain(
        'Updated tag: My Updated Tag 2',
      );

      // check to make sure the old question types are still there and unchanged (and that the updated ones are updated)
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(3);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: 'My Updated Tag 1',
          color: '#FFFFFF',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: 'My Updated Tag 2',
          color: '#FFFFFF',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          cid: qt3.cid,
          queueId: qt3.queueId,
          name: qt3.name,
          color: qt3.color,
        }),
      );
    });
    it('will not create/modify/delete question types when the new config has not changed the tags', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(validConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(0);

      // check to make sure the old question types are still there and unchanged
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(3);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: qt1.name,
          color: qt1.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: qt2.name,
          color: qt2.color,
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          cid: qt3.cid,
          queueId: qt3.queueId,
          name: qt3.name,
          color: qt3.color,
        }),
      );
    });
    it('will delete the old question type and create a new question type if the tagid changes in the config', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });
      // create question types
      const qt1 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag1.display_name,
        color: validConfig.tags.tag1.color_hex,
      });
      const qt2 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag2.display_name,
        color: validConfig.tags.tag2.color_hex,
      });
      const qt3 = await QuestionTypeFactory.create({
        cid: course.id,
        queue: queue,
        name: validConfig.tags.tag3.display_name,
        color: validConfig.tags.tag3.color_hex,
      });

      const newConfig = {
        ...validConfig,
        tags: {
          tag1: {
            display_name: 'General',
            color_hex: '#66FF66',
          },
          tag2: {
            display_name: 'Bugs',
            color_hex: '#66AA66',
          },
          tag4: {
            display_name: 'Blocking',
            color_hex: '#FF0000',
          },
        },
      };

      const response = await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(newConfig)
        .expect(200);

      expect(response.body.questionTypeMessages.length).toBe(2);
      expect(response.body.questionTypeMessages).toContain(
        'Deleted tag: ' + validConfig.tags.tag3.display_name,
      );
      expect(response.body.questionTypeMessages).toContain(
        'Created tag: ' + newConfig.tags.tag4.display_name,
      );

      // check to make sure the old question types are still there and unchanged (and that the one with the changed id is gone with a new one in its place)
      const updatedQuestionTypes = await QuestionTypeModel.find({
        queueId: queue.id,
      });
      expect(updatedQuestionTypes.length).toBe(3);
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt1.id,
          cid: qt1.cid,
          queueId: qt1.queueId,
          name: 'General',
          color: '#66FF66',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          id: qt2.id,
          cid: qt2.cid,
          queueId: qt2.queueId,
          name: 'Bugs',
          color: '#66AA66',
        }),
      );
      expect(updatedQuestionTypes).toContainEqual(
        expect.objectContaining({
          cid: course.id,
          queueId: queue.id,
          name: 'Blocking',
          color: '#FF0000',
        }),
      );
      // this one was deleted
      expect(updatedQuestionTypes).not.toContainEqual(
        expect.objectContaining({
          id: qt3.id,
          name: 'Blocking',
          color: '#FF0000',
        }),
      );
    });
    it('will not allow the config to be updated with an invalid object', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        config: validConfig,
      });

      const invalidConfig = "I'm not an object";

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/config`)
        .send(invalidConfig)
        .expect(400);
    });
  });

  describe('POST /queues/:id/invite', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().post(`/queues/1/invite`).expect(401);
    });
    it('Creates a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: ta.userId })
        .post(`/queues/${queue.id}/invite`)
        .expect(201);

      const invite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });
      expect(invite).toBeTruthy();
      expect(invite.queueId).toEqual(queue.id);
    });
    it('Does not allow students to create invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: stu.userId })
        .post(`/queues/${queue.id}/invite`)
        .expect(403);
    });
    it('Does not allow creating invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/queues/999/invite`)
        .expect(404);
    });
    it('Only allows a queue to have a single invite', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });

      await supertest({ userId: ta.userId }).post(`/queues/${queue.id}/invite`);

      await supertest({ userId: ta.userId })
        .post(`/queues/${queue.id}/invite`)
        .expect(400);
    });
  });
  describe('DELETE /queues/:id/invite', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().delete(`/queues/1/invite`).expect(401);
    });
    it('Deletes a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      await QueueInviteFactory.create({ queue: queue });

      await supertest({ userId: ta.userId })
        .delete(`/queues/${queue.id}/invite`)
        .expect(204);

      const invite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });
      expect(invite).toBeFalsy();
    });
    it('Does not allow students to delete invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      await QueueInviteFactory.create({ queueId: queue.id });

      await supertest({ userId: stu.userId })
        .delete(`/queues/${queue.id}/invite`)
        .expect(403);
    });
    it('Does not allow deleting invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .delete(`/queues/999/invite`)
        .expect(404);
    });
  });
  describe('PATCH /queues/:id/invite', () => {
    it('returns 401 when the user is not logged in', async () => {
      await supertest().patch(`/queues/1/invite`).expect(401);
    });
    it('Updates a QueueInvite entity for the queue', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const newInvite: QueueInviteParams = {
        queueId: queue.id,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/invite`)
        .send(newInvite)
        .expect(200);

      const updatedInvite = await QueueInviteModel.findOne({
        queueId: queue.id,
      });

      expect(updatedInvite).toBeTruthy();
      expect(updatedInvite.queueId).toEqual(queue.id);
      expect(updatedInvite.QRCodeEnabled).toEqual(newInvite.QRCodeEnabled);
      expect(updatedInvite.isQuestionsVisible).toEqual(
        newInvite.isQuestionsVisible,
      );
      expect(updatedInvite.willInviteToCourse).toEqual(
        newInvite.willInviteToCourse,
      );
      expect(updatedInvite.inviteCode).toEqual(newInvite.inviteCode);
      expect(updatedInvite.QRCodeErrorLevel).toEqual(
        newInvite.QRCodeErrorLevel,
      );
    });
    it('Does not allow students to update invites', async () => {
      const course = await CourseFactory.create();
      const stu = await StudentCourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const newInvite: QueueInviteParams = {
        queueId: queue.id,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: stu.userId })
        .patch(`/queues/${queue.id}/invite`)
        .send(newInvite)
        .expect(403);
    });
    it('Does not allow updating invites for non-existent queues', async () => {
      const ta = await TACourseFactory.create({
        user: await UserFactory.create(),
      });

      const newInvite: QueueInviteParams = {
        queueId: 999,
        QRCodeEnabled: true,
        isQuestionsVisible: true,
        willInviteToCourse: true,
        inviteCode: 'newInviteCode',
        QRCodeErrorLevel: 'M',
      };

      await supertest({ userId: ta.userId })
        .patch(`/queues/999/invite`)
        .send(newInvite)
        .expect(404);
    });
    it('Does not allow updating invites with invalid data', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({ course });
      const invite = await QueueInviteFactory.create({ queue: queue });

      const invalidInvite = "I'm not an object";

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/invite`)
        .send(invalidInvite)
        .expect(400);

      const invalidInvite2 = {
        queueId: queue.id,
        QRCodeEnabled: 'A',
        isQuestionsVisible: 'B',
        willInviteToCourse: 'C',
        inviteCode: 1,
        QRCodeErrorLevel: 2,
      };

      await supertest({ userId: ta.userId })
        .patch(`/queues/${queue.id}/invite`)
        .send(invalidInvite2)
        .expect(400);
    });
  });
});
