import { EmbeddableQuestionModule } from '../src/lti/embeddable-question/question/embeddable-question.module'
import { EmbeddableQuestionModel } from '../src/lti/embeddable-question/question/embeddable-question.entity'
import {
  CourseFactory,
  EmbeddableQuestionFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories'
import { setupIntegrationTest } from './util/testUtils'
import { ERROR_MESSAGES, Role } from '@koh/common'
import { pick } from 'lodash'
import { ChatbotApiService } from '../src/chatbot/chatbot-api.service'

describe('EmbeddableQuestion Integration', () => {
  const { supertest } = setupIntegrationTest(EmbeddableQuestionModule);

  describe('POST /lti/embeddable-question/:courseId', () => {
    it('returns 401 when not logged in', async () => {
      await supertest().post('/lti/embeddable-question/1').expect(401);
    });

    it('returns 404 when user is not in course and attempts to access route', async () => {
      const u = await UserFactory.create();
      const c = await CourseFactory.create();

      await supertest({ userId: u.id })
        .post(`/lti/embeddable-question/${c.id}`)
        .send({
          questionText: 'What did you learn?',
          criteriaText: 'Be specific',
        })
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when student attempts to access route', async () => {
      const c = await CourseFactory.create();
      const u = await StudentCourseFactory.create({
        course: c,
        user: await UserFactory.create(),
      });

      await supertest({ userId: u.userId })
        .post(`/lti/embeddable-question/${c.id}`)
        .send({
          questionText: 'What did you learn?',
          criteriaText: 'Be specific',
        })
        .expect(403)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([Role.TA,Role.PROFESSOR])));
    });

    it('creates a question with text and criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-question/${course.id}`)
        .send({
          questionText: 'What did you learn?',
          criteriaText: 'Be specific',
        })
        .expect(201)
        .then(res => {
          expect(res.body.questionText).toEqual('What did you learn?');
          expect(res.body.criteriaText).toEqual('Be specific');
          expect(res.body.courseId).toEqual(course.id);
        });
    });

    it('returns 400 when creating without criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-question/${course.id}`)
        .send({ questionText: 'No criteria' })
        .expect(400);
    });

    it('returns 400 when creating without question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-question/${course.id}`)
        .send({ criteriaText: 'No question' })
        .expect(400);
    });
  });

  describe('GET /lti/embeddable-question/:courseId', () => {
    it('returns 403 when a student tries to list questions', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/lti/embeddable-question/${course.id}`)
        .expect(403);
    });

    it('returns all questions for a course', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await EmbeddableQuestionFactory.createList(2,{ course });

      const res = await supertest({ userId: ta.userId })
        .get(`/lti/embeddable-question/${course.id}`)
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

      await EmbeddableQuestionFactory.create({
        course: course1,
        questionText: 'Mine',
      });
      await EmbeddableQuestionFactory.create({
        course: course2,
        questionText: 'Not mine',
      });

      const res = await supertest({ userId: ta.userId })
        .get(`/lti/embeddable-question/${course1.id}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].questionText).toEqual('Mine');
    });
  });

  describe('GET /lti/embeddable-question/:courseId/:questionId', () => {
    it('returns 404 if user is not a member of the course', async () => {
      const u = await UserFactory.create();
      const c = await CourseFactory.create();
      const q = await EmbeddableQuestionFactory.create({ course: c });
      await supertest({ userId: u.id })
        .get(`/lti/embeddable-question/${c.id}/${q.id}`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it.each([Role.STUDENT,Role.TA,Role.PROFESSOR])('allows a %s to retrieve a question', async (role) => {
      const course = await CourseFactory.create();
      const u = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course,
        role,
      })

      const question = await EmbeddableQuestionFactory.create({
        course,
        questionText: 'Sample',
      });

      await supertest({ userId: u.userId })
        .get(`/lti/embeddable-question/${course.id}/${question.id}`)
        .expect(200)
        .then(res =>  expect(pick(res.body,['criteriaText','questionText','instructions'])).toEqual(pick(question,'criteriaText','questionText','instructions')));
    });

    it('returns 404 for a nonexistent question', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/lti/embeddable-question/${course.id}/999`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.embeddableQuestionController.notFound));
    });
  });

  describe('POST /lti/embeddable-question/:courseId/:questionId/feedback', () => {
    it('returns 401 if user is not authorized', async () => {
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest()
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send()
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 400 when responseText is missing', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send({})
        .expect(400);
    });

    it('returns 400 when responseText is not a string', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send({ responseText: 123 })
        .expect(400);
    });

    it('returns 400 when responseText is only whitespace', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send({ responseText: '   ' })
        .expect(400);
    });

    it('returns a response otherwise', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      const querySpy = jest.spyOn(ChatbotApiService.prototype,'queryChatbot')
      querySpy.mockResolvedValue('feedback')

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-question/${course.id}/${question.id}/feedback`)
        .send({ responseText: 'response' })
        .expect(201)
        .then(res => expect(res.body).toEqual({ feedback: 'feedback' }));

      querySpy.mockClear();
    });
  });

  describe('PATCH /lti/embeddable-question/:courseId/:questionId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest()
        .patch(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest({ userId: user.id })
        .patch(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send()
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to update', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: student.userId })
        .patch(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send({ questionText: 'Nope', criteriaText: 'Nope' })
        .expect(403);
    });

    it('updates a question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({
        course,
        questionText: 'Original',
      });

      await supertest({ userId: ta.userId })
        .patch(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send({ questionText: 'Updated', criteriaText: 'Updated criteria' })
        .expect(200)
        .then((res) => {
          expect(res.body.questionText).toEqual('Updated');
          expect(res.body.criteriaText).toEqual('Updated criteria');
        });
    });

    it('returns 400 when updating without criteria', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({
        course,
        questionText: 'Original',
      });

      await supertest({ userId: ta.userId })
        .patch(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send({ questionText: 'Updated' })
        .expect(400);
    });
  });

  describe('DELETE /lti/embeddable-question/:courseId/:questionId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest()
        .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const question = await EmbeddableQuestionFactory.create({ course });
      await supertest({ userId: user.id })
        .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
        .send()
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to delete', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: student.userId })
        .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
        .expect(403);
    });

    it('deletes a question', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const question = await EmbeddableQuestionFactory.create({ course });

      await supertest({ userId: ta.userId })
        .delete(`/lti/embeddable-question/${course.id}/${question.id}`)
        .expect(200);

      const deleted = await EmbeddableQuestionModel.findOne({
        where: { id: question.id },
      });
      expect(deleted).toBeNull();
    });
  });
});
