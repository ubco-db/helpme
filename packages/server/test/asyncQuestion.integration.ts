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
import { setupIntegrationTest } from './util/testUtils';
import { asyncQuestionModule } from 'asyncQuestion/asyncQuestion.module';
import { AsyncQuestion, asyncQuestionStatus, Role } from '@koh/common';

describe('AsyncQuestion Integration', () => {
  const supertest = setupIntegrationTest(asyncQuestionModule);
  let course: CourseModel;
  let TAuser: UserModel;
  let studentUser: UserModel;
  let studentUser2: UserModel;
  let asyncQuestion: AsyncQuestionModel;
  beforeEach(async () => {
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
    });
  });

  describe('POST asyncQuestions/:cid', () => {
    it('Student can create a question', async () => {
      await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/${course.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text',
        })
        .expect(201)
        .then((response) => {
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
        .expect(403);
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
        .expect(403);
    });
    it('Prevents students from modifying a question', async () => {
      await supertest({ userId: studentUser.id })
        .patch(`/asyncQuestions/faculty/${asyncQuestion.id}`)
        .send({
          questionAbstract: 'abstract',
          questionText: 'text1',
        })
        .expect(401);
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
        .expect(401);
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
        .expect(403);
    });
  });

  describe('POST /asyncQuestions/:qid/:vote', () => {
    it('should vote on a question', async () => {
      const student = await UserFactory.create();
      const question = await AsyncQuestionFactory.create({
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });

      const response = await supertest({ userId: student.id }).post(
        `/asyncQuestions/${question.id}/1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.vote).toBe(1);
    });

    it('should update an existing vote on a question', async () => {
      const student = await UserFactory.create();
      const question = await AsyncQuestionFactory.create({
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      await VotesFactory.create({ userId: student.id, vote: 1, question });

      const response = await supertest({ userId: student.id }).post(
        `/asyncQuestions/${question.id}/-1`,
      );

      expect(response.status).toBe(200);
      expect(response.body.vote).toBe(0);
    });

    it('should not allow voting beyond the allowed range', async () => {
      const student = await UserFactory.create();
      const question = await AsyncQuestionFactory.create({
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });
      await VotesFactory.create({ userId: student.id, vote: 1, question });

      const response = await supertest({ userId: student.id }).post(
        `/asyncQuestions/${question.id}/2`,
      );

      expect(response.status).toBe(200);
      expect(response.body.vote).toBe(1); // original vote
    });

    it('should not allow voting by unauthorized users', async () => {
      const question = await AsyncQuestionFactory.create({
        createdAt: new Date('2020-03-01T05:00:00.000Z'),
      });

      const response = await supertest().post(
        `/asyncQuestions/${question.id}/1`,
      );

      expect(response.status).toBe(401);
    });

    it('should return an error if the question does not exist', async () => {
      const student = await UserFactory.create();

      const response = await supertest({ userId: student.id }).post(
        `/asyncQuestions/9999/1`,
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
        `/asyncQuestions/${question.id}/1`,
      );

      expect(response.status).toBe(403);
    });
  });

  describe('POST asyncQuestions/:qid/comment', () => {
    it('Student can comment on a question', async () => {
      await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty(
            'commentText',
            'Student comment 1',
          );
          expect(response.body.creator.email).toBe('justino@ubc.ca');
          expect(response.body.questionId).toBe(asyncQuestion.id);
        });
    });
    it('TA can comment on a question', async () => {
      await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: TAuser.id,
          commentText: 'TA Comment 1',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('commentText', 'TA Comment 1');
          expect(response.body.creator.email).toBe('wskksw@student.ubc.ca');
          expect(response.body.questionId).toBe(asyncQuestion.id);
        });
    });
    it('allows students and staff to comment on other students questions', async () => {
      await supertest({ userId: studentUser2.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser2.id,
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
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: TAuser.id,
          commentText: 'TA Comment 2',
        })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('commentText', 'TA Comment 2');
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
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: otherUser.id,
          commentText: 'Student comment 3',
        })
        .expect(403);
    });
  });

  describe('PATCH /asyncQuestions/comment/:commentId', () => {
    it('Student can modify their own comment', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser.id })
        .patch(`/asyncQuestions/comment/${comment.body.id}`)
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
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: TAuser.id,
          commentText: 'TA Comment 1',
        });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/comment/${comment.body.id}`)
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
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser2.id })
        .patch(`/asyncQuestions/comment/${comment.body.id}`)
        .send({
          commentText: 'Student comment 1 updated',
        })
        .expect(403);
    });
    // maybe this will be changed in the future, but for now it may seem weird to allow staff to edit student comments
    it('does not allow staff to modify students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: TAuser.id })
        .patch(`/asyncQuestions/comment/${comment.body.id}`)
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
      const comment = await supertest({ userId: otherUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: otherUser.id,
          commentText: 'Student comment 3',
        });
      await supertest({ userId: otherUser.id })
        .patch(`/asyncQuestions/comment/${comment.body.id}`)
        .send({
          commentText: 'Student comment 3 updated',
        })
        .expect(403);
    });
  });

  describe('DELETE /asyncQuestions/comment/:commentId', () => {
    it('Student can delete their own comment', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser.id }) // me (student)
        .delete(`/asyncQuestions/comment/${comment.body.id}`)
        .expect(200);
    });
    it('TA can delete their own comment', async () => {
      const comment = await supertest({ userId: TAuser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: TAuser.id,
          commentText: 'TA Comment 1',
        });
      await supertest({ userId: TAuser.id }) // me (staff)
        .delete(`/asyncQuestions/comment/${comment.body.id}`)
        .expect(200);
    });
    it('Allows staff to delete students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: TAuser.id }) // staff
        .delete(`/asyncQuestions/comment/${comment.body.id}`)
        .expect(200);
    });
    it('does not allow students to delete other students comments', async () => {
      const comment = await supertest({ userId: studentUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: studentUser.id,
          commentText: 'Student comment 1',
        });
      await supertest({ userId: studentUser2.id }) // other student
        .delete(`/asyncQuestions/comment/${comment.body.id}`)
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
      const comment = await supertest({ userId: otherUser.id })
        .post(`/asyncQuestions/comment`)
        .send({
          questionId: asyncQuestion.id,
          userId: otherUser.id,
          commentText: 'Student comment 3',
        });
      await supertest({ userId: otherUser.id })
        .delete(`/asyncQuestions/comment/${comment.body.id}`)
        .expect(403);
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
      });
      asyncQuestion3 = await AsyncQuestionFactory.create({
        creator: studentUser2,
        course: course,
      });
    });
    it('allows students to view their questions in their course', async () => {
      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(2);
      expect(questions[0].id).toBe(asyncQuestion.id);
      expect(questions[1].id).toBe(asyncQuestion2.id);
      expect(questions[0].creator.id).toBe(studentUser.id);
      expect(questions[1].creator.id).toBe(studentUser.id);
      expect(questions[0].visible).toBe(false);
      expect(questions[1].visible).toBe(true);
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
        questionTypes: [qt1, qt2],
      });

      const response = await supertest({ userId: studentUser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(3);
      expect(questions[2].id).toBe(asyncQuestion4.id);
      expect(questions[2].questionTypes).toHaveLength(2);
      expect(questions[2].questionTypes[0].name).toBe('questionType1');
      expect(questions[2].questionTypes[1].name).toBe('questionType2');
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
      expect(questions[0].comments).toHaveLength(2);
      expect(questions[0].comments[0].commentText).toBe(comment1.commentText);
      expect(questions[0].comments[1].commentText).toBe(comment2.commentText);
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
      expect(questions[0].votes).toHaveLength(2);
      expect(questions[0].votes[0].vote).toBe(vote1.vote);
      expect(questions[0].votes[1].vote).toBe(vote2.vote);
    });
    it('does not allow students to view other students questions unless the question is public, and public questions are anonymous', async () => {
      const response = await supertest({ userId: studentUser2.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      // this looks pretty <3
      expect(questions).toHaveLength(2);
      expect(questions[0].id).toBe(asyncQuestion2.id);
      expect(questions[0].creator.id).toBe(studentUser.id);
      expect(questions[0].visible).toBe(true);
      expect(questions[0].creator.name).not.toBe(studentUser.name);
      expect(questions[0].creator.email).not.toBe(studentUser.email);
      expect(questions[0].creator.photoURL).toBeNull();
      expect(questions[1].id).toBe(asyncQuestion3.id);
      expect(questions[1].creator.id).toBe(studentUser2.id);
      expect(questions[1].visible).toBe(false);
      expect(questions[1].creator.name).toBe(studentUser2.name);
      expect(questions[1].creator.email).toBe(studentUser2.email);
      expect(questions[1].creator.photoURL).toBe(studentUser2.photoURL);
    });
    it('allows staff to view all questions in their course, regardless of visibility', async () => {
      const response = await supertest({ userId: TAuser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response.status).toBe(200);
      const questions: AsyncQuestion[] = response.body;
      expect(questions).toHaveLength(3);
      expect(questions[0].id).toBe(asyncQuestion.id);
      expect(questions[1].id).toBe(asyncQuestion2.id);
      expect(questions[2].id).toBe(asyncQuestion3.id);
      // you can see the creator's name and email and photoURL
      expect(questions[0].creator.name).toBe(studentUser.name);
      expect(questions[0].creator.email).toBe(studentUser.email);
      expect(questions[0].creator.photoURL).toBe(studentUser.photoURL);
      expect(questions[1].creator.name).toBe(studentUser.name);
      expect(questions[1].creator.email).toBe(studentUser.email);
      expect(questions[1].creator.photoURL).toBe(studentUser.photoURL);
      expect(questions[2].creator.name).toBe(studentUser2.name);
      expect(questions[2].creator.email).toBe(studentUser2.email);
      expect(questions[2].creator.photoURL).toBe(studentUser2.photoURL);
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
      expect(questions[1].comments).toHaveLength(2);
      expect(questions[1].comments[0].commentText).toBe(comment1.commentText);
      expect(questions[1].comments[1].commentText).toBe(comment2.commentText);
      expect(questions[1].comments[0].creator.name).not.toBe(studentUser.name);
      expect(questions[1].comments[0].creator.email).not.toBe(
        studentUser.email,
      );
      expect(questions[1].comments[0].creator.photoURL).toBeNull();
      expect(questions[1].comments[1].creator.name).toBe(studentUser2.name);
      expect(questions[1].comments[1].creator.email).toBe(studentUser2.email);
      expect(questions[1].comments[1].creator.photoURL).toBe(
        studentUser2.photoURL,
      );
      // staff can see all comments
      const response2 = await supertest({ userId: TAuser.id }).get(
        `/asyncQuestions/${course.id}`,
      );
      expect(response2.status).toBe(200);
      const questions2: AsyncQuestion[] = response2.body;
      expect(questions2).toHaveLength(2);
      expect(questions2[1].comments).toHaveLength(2);
      expect(questions2[1].comments[0].commentText).toBe(comment1.commentText);
      expect(questions2[1].comments[1].commentText).toBe(comment2.commentText);
      expect(questions2[1].comments[0].creator.name).toBe(studentUser.name);
      expect(questions2[1].comments[0].creator.email).toBe(studentUser.email);
      expect(questions2[1].comments[0].creator.photoURL).toBe(
        studentUser.photoURL,
      );
      expect(questions2[1].comments[1].creator.name).toBe(studentUser2.name);
      expect(questions2[1].comments[1].creator.email).toBe(studentUser2.email);
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
      expect(response.status).toBe(403);
    });
  });
});
