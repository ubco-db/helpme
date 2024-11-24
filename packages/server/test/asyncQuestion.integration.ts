import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { CourseModel } from 'course/course.entity';
import { UserModel } from 'profile/user.entity';
import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  AsyncQuestionFactory,
  VotesFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { asyncQuestionModule } from 'asyncQuestion/asyncQuestion.module';
import { asyncQuestionStatus, Role } from '@koh/common';

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

  describe('Async question comment', () => {
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
  });

  describe('Async question creation', () => {
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
  });

  describe('Async question update', () => {
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

    it('Allows professors to modify a question even if they are a student in another course', async () => {
      const prof = await UserFactory.create();
      const otherCourse = await CourseFactory.create();
      await UserCourseFactory.create({
        user: prof,
        course: otherCourse,
        role: Role.STUDENT,
      });
      await UserCourseFactory.create({
        user: prof,
        course,
        role: Role.PROFESSOR,
      });
      await supertest({ userId: prof.id })
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
  });
});
