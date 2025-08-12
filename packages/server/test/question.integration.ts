import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  OpenQuestionStatus,
  QuestionStatusKeys,
  Role,
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
  UserFactory,
} from './util/factories';
import {
  expectUserNotified,
  failedPermsCheckForCourse,
  failedPermsCheckForQueue,
  modifyMockNotifs,
  setupIntegrationTest,
} from './util/testUtils';
import { forEach } from 'lodash';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { StudentTaskProgressModel } from 'studentTaskProgress/studentTaskProgress.entity';

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

  describe('POST /questions/:queueId', () => {
    const postQuestion = async (
      user: UserModel,
      queue: QueueModel,
      questionTypes: QuestionTypeModel[],
      force = false,
      isTaskQuestion = false,
      questionText = "Don't know recursion",
    ): Promise<supertest.Test> =>
      await supertest({ userId: user.id }).post(`/questions/${queue.id}`).send({
        text: questionText,
        questionTypes: questionTypes,
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
        .post(`/questions/${queue.id}`)
        .send({
          text: "Don't know recursion",
          questionTypes: [sendQuestionTypes],
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
        .post(`/questions/${queue.id}`)
        .send({
          text: "Don't know recursion",
          questionTypes: [],
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
        await QuestionTypeFactory.create({
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
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      const ta = await TACourseFactory.create({
        course: course,
        user: await UserFactory.create(),
      });
      // wait 0.25s to help deadlock issue?
      await new Promise((resolve) => setTimeout(resolve, 250));
      await supertest({ userId: user.id })
        .post('/questions/999')
        .send({
          text: "Don't know recursion",
          questionTypes: QuestionTypes,
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
    it.each([Role.PROFESSOR, Role.TA])(
      'should return 403 when staff accesses the route',
      async (role) => {
        await failedPermsCheckForQueue(
          (queueId) => `/questions/${queueId}`,
          role,
          'POST',
          supertest,
        );
      },
    );
  });

  describe('GET /questions/allQuestions/:cid', () => {
    it('should return 403 when non-staff accesses route', async () => {
      await failedPermsCheckForCourse(
        (courseId) => `/questions/allQuestions/${courseId}`,
        Role.STUDENT,
        'GET',
        supertest,
      );
    });
    it('should return 200 when staff accesses route', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ courseId: course.id, userId: ta.id });
      const queue = await QueueFactory.create({ course: course });
      const question = await QuestionFactory.create({ queue: queue });

      const response = await supertest({ userId: ta.id }).get(
        `/questions/allQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toContainEqual(
        expect.objectContaining({
          id: question.id,
          text: question.text,
          status: question.status,
          queueId: question.queueId,
          creatorName: question.creator.name,
          questionTypes: expect.arrayContaining([
            expect.objectContaining({
              name: question.questionTypes[0].name,
              color: question.questionTypes[0].color,
            }),
          ]),
        }),
      );
    });
  });

  describe('POST /questions/TAcreate/:queueId/:userId', () => {
    it('should return 403 when non-staff accesses route', async () => {
      await failedPermsCheckForQueue(
        (queueId) => `/questions/TAcreate/${queueId}/1`,
        Role.STUDENT,
        'POST',
        supertest,
      );
    });
    it('should return 201 when staff accesses route', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ courseId: course.id, userId: ta.id });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
        allowQuestions: true,
      });
      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        courseId: course.id,
        userId: student.id,
      });
      const response = await supertest({ userId: ta.id })
        .post(`/questions/TAcreate/${queue.id}/${student.id}`)
        .send({
          text: 'Help me',
          questionTypes: [],
          groupable: true,
          isTaskQuestion: false,
          force: true,
        });
      if (response.status !== 201) {
        console.error(response.body);
      }
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        text: "Don't know recursion",
        helpedAt: null,
        closedAt: null,
        questionTypes: [],
        status: QuestionStatusKeys.Queued,
        groupable: true,
      });
    });
  });

  describe('PATCH /questions/:id', () => {
    it('will accurately set waitTime and helpTime when going from Drafting -> Queued -> Helping -> Paused -> Helping -> Requeueing -> Queued -> Helping -> Resolved', async () => {
      // Create an alert to hopefully avoid create alert table error?
      await AlertFactory.create(); // I cannot BELIEVE this actually works LMAO
      // for context, this test uses jest.advanceTimersByTime to simulate time passing in order to see if waitTime and helpTime are increasing correctly.
      // For some reason, jest's fakeTimers break dates for typeorm/postgres in certain cases.
      // And typeorm seems to only create tables as they are needed.
      // So, when the status changes on one of these questions, an alert is made (e.g. Queued -> Helping "You are now being helped!"),
      // and since it's the first alert, typeorm attempts to create a table with a Date column, but that fails because jest's fakeTimers broke the dates.
      // Hence, by doing await AlertFactory.create(), it ensures that the alert table is already created before jest breaks the dates.
      // Or at least that's what I think is happening.
      // To those reading this, I hope you enjoyed this little gem <3
      jest.useFakeTimers({
        doNotFake: [
          'hrtime',
          'nextTick',
          'performance',
          'queueMicrotask',
          'requestAnimationFrame',
          'cancelAnimationFrame',
          'requestIdleCallback',
          'cancelIdleCallback',
          'setImmediate',
          'clearImmediate',
          'setInterval',
          'clearInterval',
          'setTimeout',
          'clearTimeout',
        ],
        // set time to be 12pm (midday) so that hopefully no cron jobs or something weird runs
        now: new Date('2024-01-01T12:00:00Z'),
        advanceTimers: true,
      });
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
      });
      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        user: student,
        courseId: queue.courseId,
      });

      const q = await QuestionFactory.create({
        text: 'Help pls',
        status: QuestionStatusKeys.Drafting,
        queue: queue,
        creator: student,
      });

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Drafting -> Queued
      const response1 = await supertest({ userId: student.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Queued,
        })
        .expect(200);
      expect(response1.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Queued,
      });
      expect(
        await QuestionModel.findOne({ where: { id: q.id } }),
      ).toMatchObject({
        status: QuestionStatusKeys.Queued,
        waitTime: 0, // wait time doesn't increase while being drafted
        helpTime: 0, // help time doesn't increase while being drafted
      });

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // // Queued -> Helping
      const response2 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(200);
      expect(response2.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Helping,
      });
      let question = await QuestionModel.findOne({ where: { id: q.id } });
      // help time doesn't increase while being queued
      expect(question.helpTime).toBe(0);
      // wait time increases while being queued
      expect(question.waitTime).toBeGreaterThanOrEqual(58);
      expect(question.waitTime).toBeLessThanOrEqual(62);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Helping -> Paused
      const response3 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Paused,
        })
        .expect(200);
      expect(response3.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Paused,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // help time increases while being helped
      expect(question.helpTime).toBeGreaterThanOrEqual(58);
      expect(question.helpTime).toBeLessThanOrEqual(62);
      // wait time doesn't increase while being helped
      expect(question.waitTime).toBeGreaterThanOrEqual(58);
      expect(question.waitTime).toBeLessThanOrEqual(62);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Paused -> Helping
      const response4 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(200);
      expect(response4.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Helping,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // help time doesn't increase while being paused
      expect(question.helpTime).toBeGreaterThanOrEqual(58);
      expect(question.helpTime).toBeLessThanOrEqual(62);
      // wait time increases while being paused
      expect(question.waitTime).toBeGreaterThanOrEqual(118);
      expect(question.waitTime).toBeLessThanOrEqual(122);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Helping -> Requeueing
      const response5 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.ReQueueing,
        })
        .expect(200);
      expect(response5.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.ReQueueing,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // again, help time increases while being helped
      expect(question.helpTime).toBeGreaterThanOrEqual(118);
      expect(question.helpTime).toBeLessThanOrEqual(122);
      // again, waitTime doesn't increase while being helped
      expect(question.waitTime).toBeGreaterThanOrEqual(118);
      expect(question.waitTime).toBeLessThanOrEqual(122);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Requeueing -> Queued
      const response6 = await supertest({ userId: student.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Queued,
        })
        .expect(200);
      expect(response6.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Queued,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // help time doesn't increase while being requeued
      expect(question.helpTime).toBeGreaterThanOrEqual(118);
      expect(question.helpTime).toBeLessThanOrEqual(122);
      // wait time doesn't increase while being requeued
      expect(question.waitTime).toBeGreaterThanOrEqual(118);
      expect(question.waitTime).toBeLessThanOrEqual(122);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Queued -> Helping
      const response7 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Helping,
        })
        .expect(200);
      expect(response7.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Helping,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // again, help time doesn't increase while being queued
      expect(question.helpTime).toBeGreaterThanOrEqual(118);
      expect(question.helpTime).toBeLessThanOrEqual(122);
      // again, wait time increases while being queued
      expect(question.waitTime).toBeGreaterThanOrEqual(178);
      expect(question.waitTime).toBeLessThanOrEqual(184);

      // simulate 1 minute passing
      jest.advanceTimersByTime(60 * 1000);
      // Helping -> Resolved
      const response8 = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        })
        .expect(200);
      expect(response8.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Resolved,
      });
      question = await QuestionModel.findOne({ where: { id: q.id } });
      // again, help time increases while being helped
      expect(question.helpTime).toBeGreaterThanOrEqual(178);
      expect(question.helpTime).toBeLessThanOrEqual(184);
      // again, wait time doesn't increase while being helped
      expect(question.waitTime).toBeGreaterThanOrEqual(178);
      expect(question.waitTime).toBeLessThanOrEqual(184);
      jest.useRealTimers();
    });

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
      expect(
        await QuestionModel.findOne({ where: { id: q.id } }),
      ).toMatchObject({
        text: 'NEW TEXT',
      });
    });
    it('fails to update a non-existent question', async () => {
      await supertest({ userId: 99 })
        .patch(`/questions/999`)
        .send({
          text: 'NEW TEXT',
        })
        .expect(403);
    });
    it('PATCH taHelped as student is not allowed', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const queue = await QueueFactory.create({
        courseId: course.id,
        staffList: [ta],
      });

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
    it('PATCH anything other than status, text, and questionTypes not allowed', async () => {
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });

      const q = await QuestionFactory.create({
        text: 'Help pls',
        queue: await QueueFactory.create({ course: course, staffList: [ta] }),
      });
      const qt = await QuestionTypeFactory.create({
        cid: course.id,
        queueId: q.queueId,
      });

      await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'Help please',
        })
        .expect(200);
      await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          questionTypes: [{ id: qt.id }],
        })
        .expect(200);
      await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          isTaskQuestion: true,
        })
        .expect(401);

      const updatedQuestion = await QuestionModel.findOne({
        where: { id: q.id },
      });
      expect(updatedQuestion.text).toBe('Help please');
      expect(updatedQuestion.isTaskQuestion).toBe(false);
      expect(updatedQuestion.queueId).toBe(q.queueId);
      expect(updatedQuestion.questionTypes.length).toBe(1);
      expect(updatedQuestion.questionTypes[0]).toEqual({
        cid: qt.cid,
        color: qt.color,
        deletedAt: null,
        id: qt.id,
        name: qt.name,
        queueId: qt.queueId,
      });
    });

    it('PATCH invalid state transition not allowed', async () => {
      const q = await QuestionFactory.create({ text: 'Help pls' });
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: q.queue.course, user: ta });

      q.queue.staffList.push(ta);

      const res = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
        .expect(401);
      expect(res.body?.message).toContain('ta cannot change status from ');
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
        .expect(200);
    });
    it('TaskQuestions marking: Will append on a newly completed task onto existing studentTaskProgress', async () => {
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

      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "task2"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.status).toBe(200);

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task2.isDone,
      ).toBe(true);
    });
    it('TaskQuestions marking: Will create a new studentTaskProgress entity if the student has no task progress in the course yet', async () => {
      const course = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const student = await UserFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      await StudentCourseFactory.create({ course: course, user: student });
      await StudentCourseFactory.create({ course: course2, user: student });
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
      const queue2 = await QueueFactory.create({
        course: course2,
        config: {
          assignment_id: 'assignment1',
          tasks: {
            part1: {
              display_name: 'Part 1',
              short_display_name: '1',
              color_hex: '#000000',
              precondition: null,
            },
          },
        },
      });

      // note: this is in a different course/queue
      await StudentTaskProgressFactory.create({
        user: student,
        course: course2,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue2.id,
            assignmentProgress: {
              part1: {
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "task1"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.status).toBe(200);

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress,
      ).not.toHaveProperty('part1');

      // make sure the studentTaskProgress in the other course has not been updated
      const updatedStudentTaskProgress2 =
        await StudentTaskProgressModel.findOne({
          where: { uid: student.id, cid: course2.id },
        });

      expect(updatedStudentTaskProgress2).not.toBeNull();

      expect(
        updatedStudentTaskProgress2.taskProgress.assignment1.assignmentProgress
          .part1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress2.taskProgress.assignment1.assignmentProgress,
      ).not.toHaveProperty('task1');
    });
    it('TaskQuestions marking: Will append on a newly completed task and assignment onto existing studentTaskProgress', async () => {
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

      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment2: {
            // different assignment
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              part1: {
                // different task
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "task1"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.status).toBe(200);

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress.taskProgress.assignment2.assignmentProgress
          .part1.isDone,
      ).toBe(true);
    });
    it('TaskQuestions marking: Will not allow students to mark tasks that dont exist', async () => {
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

      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "taskX"', // taskX does not exist
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
      );

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress,
      ).not.toHaveProperty('taskX');
    });
    /* Tale:
    i spent so long trying to fix this one test that kept giving this error where it was trying to do something with redis sse service after the test finished and it took sooo long to fix
    ```
    Cannot log after tests are done. Did you forget to wait for something async in your test?
    Attempted to log "Error: Connection is closed."
    ...
    at SSEService.sendEvent (../src/sse/sse.service.ts:160:22)
    at QueueSSEService.sendToRoom (../src/queue/queue-sse.service.ts:70:5)
    ```
    There was:
      - unhelpful error message, and no there was no missing await anywhere
      - an issue where tests weren't running locally due to the question.integration tests getting a bunch of deadlock errors when running locally (meaning I had to keep using github actions)
      - it did not say what test was failing or causing the issue, meaning i had to keep deleting half the tests until i could isolate the one causing the issue (it wasn't obvious)
      - this test that was failing was not modified (or in fact all of the question.integration tests were unmodified, and only one just started erroring)
      - there is a passing test almost exactly the same as the failing test. Making these two tests exactly the same will still have one of the tests fail
    and you wanna guess
    what
    the
    fix
    was?
    MOVING THE TEST FURTHER UP THE FILE
    or in other words something that should have NO EFFECT on the tests
    
    i love fragile tests that are seemingly fragile for no reason
    */
    it("TaskQuestions: Allows TAs to edit a task question's text while it is being marked and only marks the new tasks", async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      await StudentCourseFactory.create({
        user: student,
        course: course,
      });
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
        text: 'Mark "task1" "task2"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          text: 'Mark "task1"',
          status: QuestionStatusKeys.Resolved,
        });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: q1.id,
        text: 'Mark "task1"',
      });
      expect(
        await QuestionModel.findOne({ where: { id: q1.id } }),
      ).toMatchObject({
        text: 'Mark "task1"',
      });

      // check to make sure studentTaskProgress is updated
      const studentTaskProgress = await StudentTaskProgressModel.findOne({
        where: { uid: student.id, cid: course.id },
      });

      expect(studentTaskProgress).not.toBeNull();

      expect(
        studentTaskProgress.taskProgress.assignment1.assignmentProgress.task1
          .isDone,
      ).toBe(true);
      // task 2 should be undefined
      expect(
        studentTaskProgress.taskProgress.assignment1.assignmentProgress.task2,
      ).toBeUndefined();
    });
    it('TaskQuestions marking: Will not allow question text with invalid text', async () => {
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

      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "SELECT * FROM users', // invalid text
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
      );

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
    });
    it('TaskQuestions marking: Will not allow if the queue has no assignment_id defined in the config', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      await StudentCourseFactory.create({ course: course, user: student });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
        config: {
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

      await StudentTaskProgressFactory.create({
        user: student,
        course: course,
        taskProgress: {
          assignment1: {
            lastEditedQueueId: queue.id,
            assignmentProgress: {
              task1: {
                isDone: true,
              },
            },
          },
        },
      });

      const q1 = await QuestionFactory.create({
        text: 'Mark "task2"',
        queue: queue,
        isTaskQuestion: true,
        status: QuestionStatusKeys.Helping,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q1.id}`)
        .send({
          status: QuestionStatusKeys.Resolved,
        });

      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress
          .assignmentDoesNotExist,
      );
      expect(response.status).toBe(400);

      // retrieve studentTaskProgress and see if it updated
      const updatedStudentTaskProgress = await StudentTaskProgressModel.findOne(
        {
          where: { uid: student.id, cid: course.id },
        },
      );

      expect(updatedStudentTaskProgress).not.toBeNull();

      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress
          .task1.isDone,
      ).toBe(true);
      expect(
        updatedStudentTaskProgress.taskProgress.assignment1.assignmentProgress,
      ).not.toHaveProperty('task2');
    });
    it('TaskQuestions editing: Will not allow the edit if the text is invalid', async () => {
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
          text: 'PERISH WEAKLING',
        });

      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
      );
      expect(response.status).toBe(400);
    });
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
    it('TaskQuestions: When TAs modify the questions text, it checks for valid tasks', async () => {
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
        text: 'Mark "task1"',
        status: QuestionStatusKeys.Helping,
        queue: queue,
        creator: student,
        isTaskQuestion: true,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          text: 'Mark "task1" "task3"', // task3 not in config
          status: QuestionStatusKeys.Resolved,
        })
        .expect(400);
      expect(response.body.message).toBe(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
      );
    });
    it('Will set lastReadyAt when going from a waiting status to a non-waiting status (e.g. helping to queued', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({ course: course, user: ta });
      const queue = await QueueFactory.create({
        course: course,
        staffList: [ta],
      });
      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        user: student,
        courseId: queue.courseId,
      });
      const q = await QuestionFactory.create({
        text: 'Help pls',
        status: QuestionStatusKeys.Helping,
        queue: queue,
        creator: student,
        taHelped: ta,
      });

      const response = await supertest({ userId: ta.id })
        .patch(`/questions/${q.id}`)
        .send({
          status: QuestionStatusKeys.Paused,
        })
        .expect(200);
      expect(response.body).toMatchObject({
        id: q.id,
        status: QuestionStatusKeys.Paused,
      });
      expect(
        await QuestionModel.findOne({ where: { id: q.id } }),
      ).toMatchObject({
        status: QuestionStatusKeys.Paused,
        lastReadyAt: expect.any(Date),
      });
    });
  });
});
