import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  OpenQuestionStatus,
  QuestionStatusKeys,
  QuestionTypes,
  Role,
} from '@koh/common';
import { UserModel } from 'profile/user.entity';
import { QuestionGroupModel } from 'question/question-group.entity';
import { QueueModel } from 'queue/queue.entity';
import supertest from 'supertest';
import { QuestionModel } from '../src/question/question.entity';
import { QuestionModule } from '../src/question/question.module';
import {
  CourseFactory,
  QuestionFactory,
  QuestionGroupFactory,
  QuestionTypeFactory,
  QueueFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import {
  expectUserNotified,
  modifyMockNotifs,
  setupIntegrationTest,
} from './util/testUtils';
import { forEach } from 'lodash';
import { QuestionTypeModel } from 'questionType/question-type.entity';

describe('Question Integration', () => {
  const supertest = setupIntegrationTest(QuestionModule, modifyMockNotifs);

  describe('POST /questions', () => {
    const postQuestion = (
      user: UserModel,
      queue: QueueModel,
      questionTypes: QuestionTypeModel[],
      force = false,
    ): supertest.Test =>
      supertest({ userId: user.id }).post('/questions').send({
        text: "Don't know recursion",
        questionTypes: questionTypes,
        queueId: queue.id,
        force,
        groupable: true,
      });

    it('posts a new question', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();

      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const queue = await QueueFactory.create({
        course: course,
        allowQuestions: true,
        staffList: [ta.user],
      });

      const questionType = await QuestionTypeFactory.create({
        queueId: queue.id,
      });

      const sendQuestionTypes = {
        id: questionType.id,
        cid: questionType.cid,
        name: questionType.name,
        color: questionType.color,
        queueId: questionType.queueId,
      };

      await StudentCourseFactory.create({ user, courseId: queue.courseId });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(0);
      const response = await supertest({ userId: user.id })
        .post('/questions')
        .send({
          text: "Don't know recursion",
          questionTypes: [sendQuestionTypes],
          queueId: queue.id,
          force: false,
          groupable: true,
        })
        .expect(201);
      expect(response.body).toMatchObject({
        text: "Don't know recursion",
        helpedAt: null,
        closedAt: null,
        questionTypes: [sendQuestionTypes],
        status: 'Drafting',
        groupable: true,
      });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(1);
    });

    it('should allow students to post questions with no question types', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();

      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const queue = await QueueFactory.create({
        course: course,
        allowQuestions: true,
        staffList: [ta.user],
      });

      await StudentCourseFactory.create({ user, courseId: queue.courseId });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(0);
      const response = await supertest({ userId: user.id })
        .post('/questions')
        .send({
          text: "Don't know recursion",
          questionTypes: [],
          queueId: queue.id,
          force: false,
          groupable: true,
        })
        .expect(201);
      expect(response.body).toMatchObject({
        text: "Don't know recursion",
        helpedAt: null,
        closedAt: null,
        questionTypes: [],
        status: 'Drafting',
        groupable: true,
      });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(1);
    });

    it('ta cannot post  a new question', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        course: course,
        allowQuestions: true,
        staffList: [ta.user],
      });

      const questionTypes = [];

      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: course.id,
        });

        const sendQuestionTypes = {
          id: questionType.id,
          cid: questionType.cid,
          name: questionType.name,
          color: questionType.color,
          queueId: questionType.queueId,
        };
        questionTypes.push(sendQuestionTypes);
      });

      await TACourseFactory.create({ user, courseId: queue.courseId });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(0);
      await postQuestion(user, queue, questionTypes).expect(403);
    });
    it('post question fails with non-existent queue', async () => {
      await supertest({ userId: 99 })
        .post('/questions')
        .send({
          text: "Don't know recursion",
          questionTypes: QuestionTypes,
          queueId: 999,
          force: false,
          groupable: true,
        })
        .expect(404);
    });
    it('does not allow posting in course student is not in', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const queueImNotIn = await QueueFactory.create({
        allowQuestions: true,
        course: course,
        staffList: [ta.user],
      });

      expect(await queueImNotIn.checkIsOpen()).toBe(true);
      const user = await UserFactory.create();
      const course2 = await CourseFactory.create();
      await StudentCourseFactory.create({
        user,
        course: course2,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: course2.id,
        });
        questionTypes.push(currentQuestionType);
      });

      await postQuestion(user, queueImNotIn, questionTypes).expect(404);
    });

    it('post question fails on closed queue', async () => {
      const course = await CourseFactory.create({});

      const queue = await QueueFactory.create({
        course: course,
        allowQuestions: true,
        isDisabled: true,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: course.id,
        });
        questionTypes.push(currentQuestionType);
      });

      const result = await queue.checkIsOpen();
      expect(result).toBe(false);
      const user = await UserFactory.create();
      await StudentCourseFactory.create({ user, courseId: queue.courseId });
      await supertest({ userId: user.id });
      await postQuestion(user, queue, questionTypes).expect(400);
    });

    // it('post question fails with bad params', async () => {
    //   const course = await CourseFactory.create();
    //   const ta = await TACourseFactory.create({
    //     course: course,
    //     user: await UserFactory.create(),
    //   });
    //   const queue = await QueueFactory.create({
    //     courseId: course.id,
    //     allowQuestions: true,
    //     staffList: [ta.user],
    //   });

    //   const user = await UserFactory.create();
    //   await StudentCourseFactory.create({ user, courseId: queue.courseId });

    //   expect(await queue.checkIsOpen()).toBe(true);
    //   await supertest({ userId: user.id })
    //     .post('/questions')
    //     .send({
    //       text: 'I need help',
    //       questionType: 'bad param!',
    //       queueId: 1, // even with bad params we still need a queue
    //       force: false,
    //       groupable: true,
    //     })
    //     .expect(400);
    // });

    it("can't create more than one open question for the same course at a time", async () => {
      const course = await CourseFactory.create({});
      const user = await UserFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const ta2 = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue1 = await QueueFactory.create({
        allowQuestions: true,
        course: course,
        staffList: [ta2.user],
      });
      const queue2 = await QueueFactory.create({
        allowQuestions: true,
        course: course,
        staffList: [ta.user],
      });

      expect(await queue1.checkIsOpen()).toBe(true);
      expect(await queue2.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course.id,
      });
      await QuestionFactory.create({
        queueId: queue1.id,
        creator: user,
        queue: queue1,
        status: OpenQuestionStatus.Drafting,
      });

      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: course.id,
        });
        questionTypes.push(currentQuestionType);
      });

      const response = await postQuestion(user, queue2, questionTypes);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.createQuestion.oneQuestionAtATime,
      );
    });
    it('allow multiple questions across courses', async () => {
      const course1 = await CourseFactory.create({});
      const course2 = await CourseFactory.create({});
      const user = await UserFactory.create();
      const ta1 = await TACourseFactory.create({
        course: course1,
        user: await UserFactory.create(),
      });
      const ta2 = await TACourseFactory.create({
        course: course2,
        user: await UserFactory.create(),
      });
      const queue1 = await QueueFactory.create({
        allowQuestions: true,
        course: course1,
        staffList: [ta1.user],
      });
      const queue2 = await QueueFactory.create({
        allowQuestions: true,
        course: course2,
        staffList: [ta2.user],
      });
      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course1.id,
      });
      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course2.id,
      });
      await QuestionFactory.create({
        queueId: queue1.id,
        creator: user,
        queue: queue1,
        status: OpenQuestionStatus.Drafting,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: course2.id,
        });
        questionTypes.push(currentQuestionType);
      });

      const response = await postQuestion(user, queue2, questionTypes);
      expect(response.status).toBe(201);
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(1);
      expect(await QuestionModel.count({ where: { queueId: 2 } })).toEqual(1);
    });
    it('force a question when one is already open', async () => {
      const course = await CourseFactory.create({});
      const user = await UserFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      const queue = await QueueFactory.create({
        allowQuestions: true,
        course: course,
        staffList: [ta.user],
      });

      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: queue.courseId,
      });
      await QuestionFactory.create({
        queueId: queue.id,
        creator: user,
        status: OpenQuestionStatus.Drafting,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: queue.courseId,
        });
        questionTypes.push(currentQuestionType);
      });

      await postQuestion(user, queue, questionTypes).expect(201);
    });
    it('lets student (who is TA in other class) create question', async () => {
      const user = await UserFactory.create();

      // Make user a TA in other class
      const queueOther = await QueueFactory.create({});
      await TACourseFactory.create({
        userId: user.id,
        courseId: queueOther.courseId,
      });

      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      // Make them student
      const queue = await QueueFactory.create({
        allowQuestions: true,
        staffList: [ta.user],
      });
      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: queue.courseId,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: queue.courseId,
        });
        questionTypes.push(currentQuestionType);
      });

      await postQuestion(user, queue, questionTypes).expect(201);
    });
    it('works when other queues and courses exist', async () => {
      const user = await UserFactory.create();

      await QueueFactory.create({});

      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });

      // Make them student
      const queue = await QueueFactory.create({
        staffList: [ta.user],
        allowQuestions: true,
      });
      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: queue.courseId,
      });
      const questionTypes = [];
      forEach(QuestionTypes, async (questionType) => {
        const currentQuestionType = await QuestionTypeFactory.create({
          name: questionType.name,
          color: questionType.color,
          cid: queue.courseId,
        });
        questionTypes.push(currentQuestionType);
      });

      await postQuestion(user, queue, questionTypes).expect(201);
    });
  });

  describe('PATCH /questions/:id', () => {
    it('as student creator, edit a question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      const queue = await QueueFactory.create({
        staffList: [ta.user],
        courseId: course.id,
      });
      expect(await queue.checkIsOpen()).toBe(true);

      const user = await UserFactory.create();
      await StudentCourseFactory.create({ user, courseId: queue.courseId });
      const q = await QuestionFactory.create({
        text: 'Help pls',
        queue: queue,
        creator: user,
      });

      const response = await supertest({ userId: q.creatorId })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'NEW TEXT',
        })
        .expect(200);
      expect(response.body).toMatchObject({
        id: q.id,
        text: 'NEW TEXT',
      });
      expect(await QuestionModel.findOne({ id: q.id })).toMatchObject({
        text: 'NEW TEXT',
      });
    });
    it('fails to update a non-existent question', async () => {
      await supertest({ userId: 99 })
        .patch(`/questions/999`)
        .send({
          text: 'NEW TEXT',
        })
        .expect(404);
    });
    it('PATCH taHelped as student is not allowed', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const queue = await QueueFactory.create({
        courseId: course.id,
        staffList: [ta],
      });
      expect(await queue.checkIsOpen()).toBe(true);

      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        user: student,
        courseId: queue.courseId,
      });

      const q = await QuestionFactory.create({
        text: 'Help pls',
        creator: student,
        queue: queue,
      });

      await supertest({ userId: q.creatorId })
        .patch(`/questions/${q.id}`)
        .send({
          taHelped: {
            id: ta.id,
            name: ta.name,
          },
        })
        .expect(400);
    });

    it('PATCH status to helping as student not allowed', async () => {
      const course = await CourseFactory.create();

      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        courseId: course.id,
        staffList: [ta],
      });
      expect(await queue.checkIsOpen()).toBe(true);

      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        user: student,
        courseId: queue.courseId,
      });
      const q = await QuestionFactory.create({
        text: 'Help pls',
        creator: student,
        queue: queue,
      });

      await supertest({ userId: q.creatorId })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(401);
    });

    it('PATCH status to helping as TA works', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
      });
      expect(await queue.checkIsOpen()).toBe(true);

      const question = await QuestionFactory.create({
        text: 'Help pls',
        queue: queue,
      });

      const res = await supertest({ userId: ta.id })
        .patch(`/questions/${question.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        status: QuestionStatusKeys.Helping,
        taHelped: {
          id: ta.id,
          firstName: ta.firstName,
          lastName: ta.lastName,
          photoURL: ta.photoURL,
        },
      });
      expectUserNotified(question.creatorId);
    });

    it('PATCH status to Resolved as TA works', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
      });
      expect(await queue.checkIsOpen()).toBe(true);

      const q = await QuestionFactory.create({
        text: 'Help pls',
        status: QuestionStatusKeys.Helping,
        queue: queue,
        taHelped: ta,
      });

      const res = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        })
        .expect(200);
      expect(res.body).toMatchObject({
        status: QuestionStatusKeys.Resolved,
      });
    });

    it('PATCH anything other than status as TA not allowed', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const q = await QuestionFactory.create({
        text: 'Help pls',
        queue: await QueueFactory.create({ course: course, staffList: [ta] }),
      });

      expect(await q.queue.checkIsOpen()).toBe(true);

      await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'bonjour',
        })
        .expect(401);
    });
    it('PATCH invalid state transition not allowed', async () => {
      const q = await QuestionFactory.create({ text: 'Help pls' });
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: q.queue.course, user: ta });

      q.queue.staffList.push(ta);
      expect(await q.queue.checkIsOpen()).toBe(true);

      const res = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
        .expect(401);
      expect(res.body?.message).toContain('TA cannot change status from ');
    });
    it('PATCH question fails when you are not the question creator', async () => {
      const q = await QuestionFactory.create({ text: 'Help pls' });

      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        course: q.queue.course,
        user: student,
      });

      const res = await supertest({ userId: student.id })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'bonjour',
        })
        .expect(401);

      expect(res.body?.message).toBe(
        'Logged-in user does not have edit access',
      );
    });
    it('User not in course cannot patch a question', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ courseId: course.id });

      const user = await UserFactory.create();
      const q = await QuestionFactory.create({
        text: 'Help pls',
        queue: queue,
        creator: user,
      });

      await supertest({ userId: q.creatorId })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'NEW TEXT',
        })
        .expect(404); // Don't leak that course exists
    });
    it('Tries to help more than one student', async () => {
      const course = await CourseFactory.create();
      const queue = await QueueFactory.create({ courseId: course.id });

      const q1 = await QuestionFactory.create({
        text: 'Help pls',
        queue: queue,
      });
      const q2 = await QuestionFactory.create({
        text: 'Help pls 2',
        queue: queue,
      });

      const ta = await UserFactory.create();
      await TACourseFactory.create({ courseId: queue.courseId, user: ta });
      queue.staffList.push(ta);
      expect(await queue.checkIsOpen()).toBe(true);

      await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(200);
      await supertest({ userId: ta.id })
        .patch(`/questions/${q2.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(400);
    });
  });
});
