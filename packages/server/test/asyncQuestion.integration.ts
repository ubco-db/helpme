import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { CourseModel } from 'course/course.entity';
import { UserModel } from 'profile/user.entity';
import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  AsyncQuestionFactory,
  VotesFactory,
  QuestionTypeFactory,
  AsyncQuestionCommentFactory,
} from './util/factories';
import { overrideRedisQueue, setupIntegrationTest } from './util/testUtils';
import { asyncQuestionModule } from 'asyncQuestion/asyncQuestion.module';
import { AsyncQuestion, asyncQuestionStatus, Role } from '@koh/common';
import { AsyncQuestionVotesModel } from 'asyncQuestion/asyncQuestionVotes.entity';
import { UnreadAsyncQuestionModel } from 'asyncQuestion/unread-async-question.entity';

describe('AsyncQuestion Integration', () => {
  const { supertest } = setupIntegrationTest(
    asyncQuestionModule,
    overrideRedisQueue,
  );

  let course: CourseModel;
  let TAuser: UserModel;
  let studentUser: UserModel;
  let studentUser2: UserModel;
  let asyncQuestion: AsyncQuestionModel;
  beforeEach(async () => {
    jest.clearAllMocks();
    TAuser = await UserFactory.create({
      email: 'wskksw@student.ubc.ca',
      firstName: 'kevin',
      lastName: 'wang',
    });
    studentUser = await UserFactory.create({
      email: 'justino@ubc.ca',
      firstName: 'justin',
      lastName: 'oh',
    });
    studentUser2 = await UserFactory.create({
      email: 'tom@ubc.ca',
      firstName: 'tom',
      lastName: 'oh',
    });
    course = await CourseFactory.create({
      name: 'Test course',
    });
    await UserCourseFactory.create({
      user: TAuser,
      course,
      role: Role.TA,
    });
    await UserCourseFactory.create({
      user: studentUser,
      course,
      role: Role.STUDENT,
    });
    await UserCourseFactory.create({
      user: studentUser2,
      course,
      role: Role.STUDENT,
    });

    asyncQuestion = await AsyncQuestionFactory.create({
      creator: studentUser,
      course: course,
      aiAnswerText: 'q1',
    });
  });

  describe('POST asyncQuestions/:cid', () => {
    it('Student can create a question', async () => {
      const [prevRecords, prevCount] =
        await UnreadAsyncQuestionModel.findAndCount({
          where: {
            userId: studentUser2.id,
            courseId: course.id,
          },
        });

      await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(201)
        .then(async (response) => {
          const [currentRecords, currentCount] =
            await UnreadAsyncQuestionModel.findAndCount({
              where: {
                userId: studentUser2.id,
                courseId: course.id,
              },
            });
          expect(currentCount).toBe(prevCount + 1);

          expect(response.body).toHaveProperty('status', 'AIAnswered');
          expect(response.body).toHaveProperty('closedAt', null);
          expect(response.body).toHaveProperty('questionText', 'text');
          expect(response.body.status).toBe('AIAnswered');
          expect(response.body.closedAt).toBeNull();
        });
    });
    it('prevents users outside this course from posting questions', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      await supertest({ userId: otherUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(404);
    });
  });

  describe('PATCH /asyncQuestions/faculty/:questionId', () => {
    it('Prevents faculty in other courses from modifying a question', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.PROFESSOR,
      });
      await supertest({ userId: otherUser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text1',
        })
        .expect(404);
    });
    it('Prevents students from modifying a question', async () => {
      await supertest({ userId: studentUser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text1',
        })
        .expect(403);
    });
    it('Faculty can modify any question', async () => {
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text1',
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('questionText', 'text1');
        });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          status: asyncQuestionStatus.HumanAnswered,
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'status',
            asyncQuestionStatus.HumanAnswered,
          );
          expect(response.body).toHaveProperty('closedAt');
          expect(response.body.status).toBe(asyncQuestionStatus.HumanAnswered);
          expect(response.body.closedAt).not.toBeNull();
        });
    });
    it('Allows staff to modify a question in their course even if they are a student in another course', async () => {
      const otherCourse = await CourseFactory.create();
      await UserCourseFactory.create({
        user: TAuser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          status: asyncQuestionStatus.HumanAnswered,
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'status',
            asyncQuestionStatus.HumanAnswered,
          );
          expect(response.body.status).toBe(asyncQuestionStatus.HumanAnswered);
        });
    });
  });

  describe('PATCH /asyncQuestions/student/:questionId', () => {
    it('Student can modify their own question', async () => {
      await supertest({ userId: studentUser.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({
          status: asyncQuestionStatus.AIAnswered,
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'status',
            asyncQuestionStatus.AIAnswered,
          );
          expect(response.body.status).toBe(asyncQuestionStatus.AIAnswered);
        });
    });

    it('Student cannot modify other students question', async () => {
      await supertest({ userId: studentUser2.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({
          status: asyncQuestionStatus.HumanAnswered,
        })
        .expect(403);
    });
    it('Prevents students from modifying a question in another course', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      await supertest({ userId: otherUser.id })
        .patch(`/asyncQuestions/student/${asyncQuestion.id}`)
        .send({
          status: asyncQuestionStatus.HumanAnswered,
        })
        .expect(404);
    });
  });

  describe('POST /asyncQuestions/vote/:qid/:vote', () => {
    it('should vote on a question', async () => {
      const response = await supertest({ userId: studentUser2.id }).post(
        `/asyncQuestions/vote/${asyncQuestion.id}/1`,
      );
      expect(response.status).toBe(200);
      expect(response.body.vote).toBe(1);
    });
    it('should update an existing vote on a question', async () => {
      await VotesFactory.create({
        userId: studentUser.id,
        vote: 1,
        question: asyncQuestion,
      });
      const response = await supertest({ userId: studentUser.id }).post(
        `/asyncQuestions/vote/${asyncQuestion.id}/-1`,
      );
      expect(response.status).toBe(200);
      expect(response.body.vote).toBe(0);
    });
    it('should not allow voting beyond the allowed range', async () => {
      await VotesFactory.create({
        userId: studentUser.id,
        vote: 1,
        question: asyncQuestion,
      });
      const response = await supertest({ userId: studentUser.id }).post(
        `/asyncQuestions/vote/${asyncQuestion.id}/2`,
      );
      expect(response.status).toBe(400);
      // vote should not have changed
      const updatedVote = await AsyncQuestionVotesModel.findOne({
        where: {
          userId: studentUser.id,
          questionId: asyncQuestion.id,
        },
      });
      expect(updatedVote).not.toBeNull();
      expect(updatedVote.vote).toBe(1);
    });
    it('should not allow voting by unauthorized users', async () => {
      const response = await supertest().post(
        `/asyncQuestions/vote/${asyncQuestion.id}/1`,
      );
      expect(response.status).toBe(401);
    });
    it('should return an error if the question does not exist', async () => {
      const response = await supertest({ userId: studentUser.id }).post(
        `/asyncQuestions/vote/9999/1`,
      );
      expect(response.status).toBe(404);
    });
    it('should prevent users from voting on questions in other courses', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      const question = await AsyncQuestionFactory.create({
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      const response = await supertest({ userId: otherUser.id }).post(
        `/asyncQuestions/vote/${question.id}/1`,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST asyncQuestions/comment/:qid', () => {
    it('Student can comment on a question', async () => {
      await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'commentText',
            'Student comment 1',
          );
          expect(response.body).toHaveProperty('creator');
          expect(response.body.questionId).toBe(asyncQuestion.id);
        });
    });
    it('TA can comment on a question', async () => {
      await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'TA Comment 1',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('commentText', 'TA Comment 1');
          expect(response.body).toHaveProperty('creator');
          expect(response.body.questionId).toBe(asyncQuestion.id);
        });
    });
    it('allows students and staff to comment on other students questions', async () => {
      await supertest({ userId: studentUser2.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 2',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'commentText',
            'Student comment 2',
          );
        });
      await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'TA Comment 2',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('commentText', 'TA Comment 2');
          expect(response.body).toHaveProperty('creator');
        });
    });
    it('prevents users outside this course from posting comments', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      await supertest({ userId: otherUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 3',
        })
        .expect(404);
    });
    it('If question is visible, will mark the question as unread for everyone except the comment creator', async () => {
      // must first call the create async question endpoint since that one creates the initial notifications
      const res = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(201);
      const asyncQuestionFromResponse: AsyncQuestionModel = res.body;

      // check to make sure everyone now has unread entities, and that its marked as unread only for staff
      const unreadEntities = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntities.length).toBe(3); // everyone has an unread entity, only the staff ones are marked as unread
      expect(unreadEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false,
          }),
        ]),
      );
      // now mark question as visible
      const asyncQuestion = await AsyncQuestionModel.findOneOrFail({
        where: {
          id: asyncQuestionFromResponse.id,
        },
      });
      asyncQuestion.visible = true;
      await asyncQuestion.save();

      // mark it as has been read by TA
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/unread_async_count/${course.id}`)
        .expect(200);

      // now create a comment
      await supertest({ userId: studentUser2.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        })
        .expect(201);
      // check to make sure its marked unread for everyone except comment creator
      const unreadEntitiesAfterComment = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntitiesAfterComment.length).toBe(3);
      expect(unreadEntitiesAfterComment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false,
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true, // studentUser2 is comment creator, so it should still be marked as read
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false,
          }),
        ]),
      );
    });
    it('If question is not visible and comment is from staff, will mark the question as unread only for the question creator', async () => {
      // must first call the create async question endpoint since that one creates the initial notifications
      const res = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(201);
      const asyncQuestionFromResponse: AsyncQuestionModel = res.body;

      // check to make sure everyone now has unread entities, and that its marked as unread only for staff
      const unreadEntities = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntities.length).toBe(3); // everyone has an unread entity, only the staff ones are marked as unread
      expect(unreadEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false,
          }),
        ]),
      );
      // mark as read by TAuser
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/unread_async_count/${course.id}`)
        .expect(200);

      // now create a comment
      await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment/${asyncQuestionFromResponse.id}`)
        .send({
          commentText: 'FEEL THE BURN',
        })
        .expect(201);
      // check to make sure its marked unread only for question creator
      const unreadEntitiesAfterComment = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntitiesAfterComment.length).toBe(3);
      expect(unreadEntitiesAfterComment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false, // it should be marked as unread for studentUser since the comment is from staff
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
        ]),
      );
    });
    it('If the question is not visible and the comment is from the question creator, will mark the question as unread for all staff', async () => {
      // must first call the create async question endpoint since that one creates the initial notifications
      const res = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(201);
      const asyncQuestionFromResponse: AsyncQuestionModel = res.body;

      // check to make sure everyone now has unread entities, and that its marked as unread only for staff
      const unreadEntities = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntities.length).toBe(3); // everyone has an unread entity, only the staff ones are marked as unread
      expect(unreadEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false,
          }),
        ]),
      );
      // mark as read by TAuser
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/unread_async_count/${course.id}`)
        .expect(200);

      // now create a comment
      await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestionFromResponse.id}`)
        .send({
          commentText: 'FEEL IT IN YOUR BONES, YOU LOVE TESTING',
        })
        .expect(201);
      // check to make sure its marked unread for all staff
      const unreadEntitiesAfterComment = await UnreadAsyncQuestionModel.find({
        where: {
          courseId: course.id,
        },
      });
      expect(unreadEntitiesAfterComment.length).toBe(3);
      expect(unreadEntitiesAfterComment).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: studentUser2.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: TAuser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestionFromResponse.id,
            readLatest: false, // mark unread for staff
          }),
        ]),
      );
    });
  });

  describe('PATCH /asyncQuestions/comment/:qid/:commentId', () => {
    it('Student can modify their own comment', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser.id })
        .patch(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`)
        .send({
          commentText: 'Student comment 1 updated',
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'commentText',
            'Student comment 1 updated',
          );
        });
    });
    it('TA can modify their own comment', async () => {
      const comment = await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'TA Comment 1',
        });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`)
        .send({
          commentText: 'TA Comment 1 updated',
        })
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'commentText',
            'TA Comment 1 updated',
          );
        });
    });
    it('does not allow students to modify other students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser2.id })
        .patch(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`)
        .send({
          commentText: 'Student comment 1 updated',
        })
        .expect(403);
    });
    // maybe this will be changed in the future, but for now it may seem weird to allow staff to edit student comments
    it('does not allow staff to modify students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`)
        .send({
          commentText: 'Student comment 1 updated',
        })
        .expect(403);
    });
    it('prevents users outside this course from modifying comments', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      const comment = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion,
        creator: otherUser,
        commentText: 'Student comment 3',
      });
      await supertest({ userId: otherUser.id })
        .patch(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.id}`)
        .send({
          commentText: 'Student comment 3 updated',
        })
        .expect(404);
    });
  });

  describe('DELETE /asyncQuestions/comment/:qid/:commentId', () => {
    it('Student can delete their own comment', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser.id }) // me (student)
        .delete(
          `/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`,
        )
        .expect(200);
    });
    it('TA can delete their own comment', async () => {
      const comment = await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'TA Comment 1',
        });
      await supertest({ userId: TAuser.id }) // me (staff)
        .delete(
          `/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`,
        )
        .expect(200);
    });
    it('Allows staff to delete students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: TAuser.id }) // staff
        .delete(
          `/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`,
        )
        .expect(200);
    });
    it('does not allow students to delete other students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment/${asyncQuestion.id}`)
        .send({
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser2.id }) // other student
        .delete(
          `/asyncQuestions/comment/${asyncQuestion.id}/${comment.body.id}`,
        )
        .expect(403);
    });
    it('prevents users outside this course from deleting comments', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      const comment = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion,
        creator: otherUser,
        commentText: 'Student comment 3',
      });
      await supertest({ userId: otherUser.id })
        .delete(`/asyncQuestions/comment/${asyncQuestion.id}/${comment.id}`)
        .expect(404);
    });
  });

  describe('GET /asyncQuestions/:courseId', () => {
    let asyncQuestion2: AsyncQuestionModel;
    let asyncQuestion3: AsyncQuestionModel;
    beforeEach(async () => {
      //create some more questions
      asyncQuestion2 = await AsyncQuestionFactory.create({
        creator: studentUser,
        course: course,
        visible: true,
        aiAnswerText: 'q2',
      });
      asyncQuestion3 = await AsyncQuestionFactory.create({
        creator: studentUser2,
        course: course,
        aiAnswerText: 'q3',
      });
    });
    it('allows students to view their questions in their course', async () => {
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(2);
      expect(questions).toMatchSnapshot();
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion.id,
            creator: expect.objectContaining({ id: studentUser.id }),
            visible: false,
          }),
          expect.objectContaining({
            id: asyncQuestion2.id,
            creator: expect.objectContaining({ id: studentUser.id }),
            visible: true,
          }),
        ]),
      );
    });
    it('should include the questionTypes in the response', async () => {
      const qt1 = await QuestionTypeFactory.create({
        name: 'questionType1',
      });
      const qt2 = await QuestionTypeFactory.create({
        name: 'questionType2',
      });
      const asyncQuestion4 = await AsyncQuestionFactory.create({
        creator: studentUser,
        course: course,
        aiAnswerText: 'q4',
        questionTypes: [qt1, qt2],
      });

      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(3);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion4.id,
            questionTypes: expect.arrayContaining([
              expect.objectContaining({ name: 'questionType1' }),
              expect.objectContaining({ name: 'questionType2' }),
            ]),
          }),
        ]),
      );
    });
    it('should include the comments in the response', async () => {
      const comment1 = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion,
        creator: studentUser,
        commentText: 'comment1',
      });
      const comment2 = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion,
        creator: studentUser2,
        commentText: 'comment2',
      });
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(2);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion.id,
            comments: expect.arrayContaining([
              expect.objectContaining({ commentText: comment1.commentText }),
              expect.objectContaining({ commentText: comment2.commentText }),
            ]),
          }),
        ]),
      );
    });
    it('should include the votes in the response', async () => {
      const vote1 = await VotesFactory.create({
        question: asyncQuestion,
        userId: studentUser.id,
        vote: 1,
      });
      const vote2 = await VotesFactory.create({
        question: asyncQuestion,
        userId: studentUser2.id,
        vote: -1,
      });
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(2);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion.id,
            votes: expect.arrayContaining([
              expect.objectContaining({ vote: vote1.vote }),
              expect.objectContaining({ vote: vote2.vote }),
            ]),
          }),
        ]),
      );
    });
    it('does not allow students to view other students questions unless the question is public, and public questions are anonymous', async () => {
      const response = await supertest({ userId: studentUser2.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion2.id,
            creator: expect.not.objectContaining({
              email: expect.anything(), // email should not be visible
            }),
          }),
          expect.objectContaining({
            id: asyncQuestion2.id,
            creator: expect.not.objectContaining({
              id: expect.anything(), // id should not be visible
            }),
          }),
          expect.objectContaining({
            id: asyncQuestion2.id,
            visible: true,
            creator: expect.objectContaining({
              anonId: expect.any(Number),
              colour: expect.any(String),
              // redacted name, photoURL, id
              name: expect.not.stringContaining(
                `${studentUser.firstName} ${studentUser.lastName}`,
              ),
              photoURL: null,
            }),
          }),
          expect.objectContaining({
            id: asyncQuestion3.id,
            visible: false,
            creator: expect.objectContaining({
              anonId: expect.any(Number),
              colour: expect.any(String),
              id: studentUser2.id,
              name: `${studentUser2.firstName} ${studentUser2.lastName}`,
              photoURL: studentUser2.photoURL,
            }),
          }),
        ]),
      );
    });
    it('allows staff to view all questions in their course, regardless of visibility', async () => {
      const response = await supertest({ userId: TAuser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(3);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: asyncQuestion.id,
            creator: expect.objectContaining({
              id: studentUser.id,
              name: `${studentUser.firstName} ${studentUser.lastName}`,
              photoURL: studentUser.photoURL,
            }),
          }),
          expect.objectContaining({
            id: asyncQuestion2.id,
            creator: expect.objectContaining({
              id: studentUser.id,
              name: `${studentUser.firstName} ${studentUser.lastName}`,
              photoURL: studentUser.photoURL,
            }),
          }),
          expect.objectContaining({
            id: asyncQuestion3.id,
            creator: expect.objectContaining({
              id: studentUser2.id,
              name: `${studentUser2.firstName} ${studentUser2.lastName}`,
              photoURL: studentUser2.photoURL,
            }),
          }),
        ]),
      );
    });
    it('does not show sensitive information for comments on questions unless they are the creator or staff', async () => {
      const comment1 = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion2,
        creator: studentUser,
        commentText: 'comment1',
      });
      const comment2 = await AsyncQuestionCommentFactory.create({
        question: asyncQuestion2,
        creator: studentUser2,
        commentText: 'comment2',
      });
      const response = await supertest({ userId: studentUser2.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(2);
      expect(questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            comments: expect.arrayContaining([
              expect.objectContaining({
                commentText: comment1.commentText,
                creator: expect.not.objectContaining({
                  email: expect.anything(), // email should not be visible
                }),
              }),
              expect.objectContaining({
                commentText: comment1.commentText,
                creator: expect.not.objectContaining({
                  id: expect.anything(), // id should not be visible
                }),
              }),
              expect.objectContaining({
                commentText: comment1.commentText,
                creator: expect.not.objectContaining({
                  name: expect.anything(), // name should not be visible
                }),
              }),
              expect.not.objectContaining({
                commentText: comment1.commentText,
                creatorId: expect.anything(), // creatorId should not be visible
              }),
              expect.objectContaining({
                commentText: comment1.commentText,
                creator: expect.objectContaining({
                  anonId: expect.any(Number),
                  colour: expect.any(String),
                  photoURL: null,
                }),
              }),
              expect.objectContaining({
                commentText: comment2.commentText,
                creator: expect.objectContaining({
                  anonId: expect.any(Number),
                  colour: expect.any(String),
                  id: studentUser2.id,
                  name: `${studentUser2.firstName} ${studentUser2.lastName}`,
                  photoURL: studentUser2.photoURL,
                }),
              }),
            ]),
          }),
        ]),
      );
      // staff can see all comments
      const response2 = await supertest({ userId: TAuser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response2.status).toBe(200);
      const questions2: AsyncQuestion[] = response2.body;
      expect(questions2).toHaveLength(3);
      expect(questions2).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            comments: expect.arrayContaining([
              expect.objectContaining({
                commentText: comment1.commentText,
                creator: expect.objectContaining({
                  anonId: expect.any(Number),
                  colour: expect.any(String),
                  id: studentUser.id,
                  name: `${studentUser.firstName} ${studentUser.lastName}`,
                  photoURL: studentUser.photoURL,
                }),
              }),
              expect.objectContaining({
                commentText: comment2.commentText,
                creator: expect.objectContaining({
                  anonId: expect.any(Number),
                  colour: expect.any(String),
                  id: studentUser2.id,
                  name: `${studentUser2.firstName} ${studentUser2.lastName}`,
                  photoURL: studentUser2.photoURL,
                }),
              }),
            ]),
          }),
        ]),
      );
      const allQuestions = {
        student: questions,
        staff: questions2,
      };
      expect(allQuestions).toMatchSnapshot();
    });
    it('prevents users outside this course from viewing questions', async () => {
      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.STUDENT,
      });
      const response = await supertest({ userId: otherUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('GET /asyncQuestions/unread_async_count/:courseId', () => {
    it('should return the unread count for the user', async () => {
      await UnreadAsyncQuestionModel.create({
        userId: studentUser.id,
        courseId: course.id,
        asyncQuestionId: asyncQuestion.id,
        readLatest: false,
      }).save();
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/unread_async_count/${course.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.count).toEqual(1);
    });
    it('should return 0 if there are no unread questions', async () => {
      // case: entity is not yet created
      const response = await supertest({ userId: studentUser2.id }).get(
        `/asyncQuestions/unread_async_count/${course.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.count).toEqual(0);
      // case: entity is created but readLatest is true
      await UnreadAsyncQuestionModel.create({
        userId: studentUser.id,
        courseId: course.id,
        asyncQuestionId: asyncQuestion.id,
        readLatest: true,
      }).save();
      const response2 = await supertest({ userId: studentUser2.id }).get(
        `/asyncQuestions/unread_async_count/${course.id}`,
      );
      expect(response2.status).toBe(200);
      expect(response2.body.count).toEqual(0);
    });
    it('should return 0 if the user is not in the course', async () => {
      const otherCourse = await CourseFactory.create();
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/unread_async_count/${otherCourse.id}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.count).toEqual(0);
    });
  });
  describe('PATCH /asyncQuestions/unread_async_count/:courseId', () => {
    it('should mark all unread questions as read for user', async () => {
      await UnreadAsyncQuestionModel.create({
        userId: studentUser.id,
        courseId: course.id,
        asyncQuestionId: asyncQuestion.id,
        readLatest: false,
      }).save();
      // create another question
      const asyncQuestion2 = await AsyncQuestionFactory.create({
        creator: studentUser,
        course: course,
        aiAnswerText: 'q2',
      });
      await UnreadAsyncQuestionModel.create({
        userId: studentUser.id,
        courseId: course.id,
        asyncQuestionId: asyncQuestion2.id,
        readLatest: false,
      }).save();
      const response = await supertest({ userId: studentUser.id }).patch(
        `/asyncQuestions/unread_async_count/${course.id}`,
      );
      expect(response.status).toBe(200);
      const unreadEntities = await UnreadAsyncQuestionModel.find({
        where: {
          userId: studentUser.id,
          courseId: course.id,
        },
      });
      expect(unreadEntities).toHaveLength(2);
      expect(unreadEntities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestion.id,
            readLatest: true,
          }),
          expect.objectContaining({
            userId: studentUser.id,
            courseId: course.id,
            asyncQuestionId: asyncQuestion2.id,
            readLatest: true,
          }),
        ]),
      );
    });
    it('should not fail if there were no unread questions to mark read', async () => {
      const response = await supertest({ userId: studentUser2.id }).patch(
        `/asyncQuestions/unread_async_count/${course.id}`,
      );
      expect(response.status).toBe(200);
    });
    it('should not fail if the user is not in the course (since it is okay because you can only update your own unread count)', async () => {
      const otherCourse = await CourseFactory.create();
      const response = await supertest({ userId: studentUser.id }).patch(
        `/asyncQuestions/unread_async_count/${otherCourse.id}`,
      );
      expect(response.status).toBe(200);
    });
  });
});
