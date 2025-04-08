import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  QuestionStatus,
  QuestionStatusKeys,
} from '@koh/common';
import { UserModel } from 'profile/user.entity';
import { QueueModel } from 'queue/queue.entity';
import supertest from 'supertest';
import { QuestionModel } from '../src/question/question.entity';
import { QuestionModule } from '../src/question/question.module';
import {
  AlertFactory,
  CourseFactory,
  QuestionFactory,
  QuestionTypeFactory,
  QueueFactory,
  StudentCourseFactory,
  StudentTaskProgressFactory,
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
import { StudentTaskProgressModel } from 'studentTaskProgress/studentTaskProgress.entity';
import { QUESTION_STATES } from '../src/question/question-fsm';

describe('Question Integration', () => {
  const { supertest } = setupIntegrationTest(QuestionModule, modifyMockNotifs);

  const QuestionTypes = [
    {
      id: 1,
      cid: 1,
      name: 'Concept',
      color: '#000000',
    },
    {
      id: 2,
      cid: 2,
      name: 'Clarification',
      color: '#000000',
    },
    {
      id: 3,
      cid: 3,
      name: 'Testing',
      color: '#000000',
    },
    {
      id: 4,
      cid: 4,
      name: 'Bug',
      color: '#000000',
    },
    {
      id: 5,
      cid: 5,
      name: 'Setup',
      color: '#000000',
    },
    {
      id: 6,
      cid: 6,
      name: 'Other',
      color: '#000000',
    },
  ];

  describe('POST /questions', () => {
    const postQuestion = async (
      user: UserModel,
      queue: QueueModel,
      questionTypes: QuestionTypeModel[],
      force = false,
      isTaskQuestion = false,
      questionText = "Don't know recursion",
    ): Promise<supertest.Test> =>
      await supertest({ userId: user.id }).post('/questions').send({
        text: questionText,
        questionTypes: questionTypes,
        queueId: queue.id,
        force: force,
        groupable: true,
        isTaskQuestion,
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
          queueId: queue.id,
        };
        questionTypes.push(sendQuestionTypes);
      });

      await TACourseFactory.create({ user, courseId: queue.courseId });
      expect(await QuestionModel.count({ where: { queueId: 1 } })).toEqual(0);
      const response = await postQuestion(user, queue, questionTypes);
      expect(response.status).toBe(403);
    });
    it('post question fails with non-existent queue', async () => {
      // wait 0.25s to help deadlock issue?
      await new Promise((resolve) => setTimeout(resolve, 250));
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

      const response = await postQuestion(user, queueImNotIn, questionTypes);
      expect(response.status).toBe(404);
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
      const response = await postQuestion(user, queue, questionTypes);
      expect(response.status).toBe(400);
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
    it("can't create more than one open demo for the same course at a time", async () => {
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
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: 'T1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
      });
      const queue2 = await QueueFactory.create({
        allowQuestions: true,
        course: course,
        staffList: [ta.user],
        config: {
          assignment_id: 'assignment2',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: 'T1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
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
        isTaskQuestion: true,
        status: OpenQuestionStatus.Queued,
        text: 'Mark "task1"',
      });

      const response = await postQuestion(
        user,
        queue2,
        [],
        false,
        true,
        'Mark "task1"',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime,
      );
    });
    it('does not allow the posting of demos with invalid tasks', async () => {
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
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: 'T1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
      });

      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course.id,
      });

      const response = await postQuestion(
        user,
        queue,
        [],
        false,
        true,
        'Mark "part5"',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
      );
    });
    it('does not allow posting of demos if the queue has no tasks defined', async () => {
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
        config: {},
      });

      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course.id,
      });

      const response = await postQuestion(
        user,
        queue,
        [],
        false,
        true,
        'Mark "task1"',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress
          .configDoesNotExist,
      );
    });
    it('does not allow posting of demos with an invalid question text', async () => {
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
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: 'T1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
      });

      expect(await queue.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course.id,
      });

      const response = await postQuestion(
        user,
        queue,
        [],
        false,
        true,
        "ain't that just a kick in the head",
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
      );
    });
    it('can allow you to create one open demo and one open question for the same course at a time, but no more than that', async () => {
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
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: 'T1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
      });

      expect(await queue1.checkIsOpen()).toBe(true);
      expect(await queue2.checkIsOpen()).toBe(true);

      await StudentCourseFactory.create({
        userId: user.id,
        courseId: course.id,
      });

      const res1 = await postQuestion(
        user,
        queue2,
        [],
        false,
        true,
        'Mark "task1"',
      );
      expect(res1.status).toBe(201);
      const response = await postQuestion(user, queue2, [], false, false);
      expect(response.status).toBe(201);

      // now try to create a demo question and a regular question. It should fail
      const response2 = await postQuestion(
        user,
        queue2,
        [],
        false,
        true,
        'Mark "task1"',
      );

      expect(response2.status).toBe(400);
      expect(response2.body.message).toBe(
        ERROR_MESSAGES.questionController.createQuestion.oneDemoAtATime,
      );

      const response3 = await postQuestion(user, queue2, [], false, false);

      expect(response3.status).toBe(400);
      expect(response3.body.message).toBe(
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

      const response = await postQuestion(user, queue, questionTypes);
      expect(response.status).toBe(201);
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

      const response = await postQuestion(user, queue, questionTypes);
      expect(response.status).toBe(201);
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

      const response = await postQuestion(user, queue, questionTypes);
      expect(response.status).toBe(201);
    });
  });

  describe('PATCH /questions/:id', () => {
    it('TaskQuestions editing: Will not allow the edit if the task is not in the config', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      await StudentCourseFactory.create({ course: course, user: student });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: '1',
              color_hex: '#000000',
              precondition: null,
            },
            task2: {
              display_name: 'Task 2',
              short_display_name: '2',
              color_hex: '#000000',
              precondition: 'task1',
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "task1"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Queued,
        creator: student,
      });

      const response = await supertest({ userId: student.id })
        .patch(`/questions/${q1.id}`)
        .send({
          text: 'Mark "task1" "task3"', // task3 not in config
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
      );
    });
    it("TaskQuestions: Allows TAs to edit a task question's text while it is being marked and only marks the new tasks", async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
        config: {
          assignment_id: 'assignment1',
          tasks: {
            task1: {
              display_name: 'Task 1',
              short_display_name: '1',
              color_hex: '#000000',
              precondition: null,
            },
            task2: {
              display_name: 'Task 2',
              short_display_name: '2',
              color_hex: '#000000',
              precondition: 'task1',
            },
          },
        },
      });
      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        user: student,
        courseId: queue.courseId,
      });

      const q = await QuestionFactory.create({
        text: 'Mark "task1" "task2"',
        status: QuestionStatusKeys.Helping,
        queue: queue,
        creator: student,
        isTaskQuestion: true,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'Mark "task1"',
          status: QuestionStatusKeys.Resolved,
        })
        .expect(200);
      expect(response.body).toMatchObject({
        id: q.id,
        text: 'Mark "task1"',
      });
      expect(await QuestionModel.findOne({ id: q.id })).toMatchObject({
        text: 'Mark "task1"',
      });

      // check to make sure studentTaskProgress is updated
      const studentTaskProgress = await StudentTaskProgressModel.findOne({
        where: { user: student, course: course },
      });
      expect(
        studentTaskProgress.taskProgress.assignment1.assignmentProgress.task1
          .isDone,
      ).toBe(true);
      // task 2 should be undefined
      expect(
        studentTaskProgress.taskProgress.assignment1.assignmentProgress.task2,
      ).toBeUndefined();
    });
  });
});
