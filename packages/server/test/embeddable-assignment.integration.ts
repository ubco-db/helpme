import {
  CourseFactory,
  EmbeddableAssignmentFactory,
  EmbeddableAssignmentFeedbackFactory,
  EmbeddableAssignmentQuestionFactory,
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
import { EmbeddableModule } from '../src/lti/embeddable/embeddable.module'
import { EmbeddableQuestionFeedbackModel } from '../src/lti/embeddable/question/embeddable-question-feedback.entity'
import { EmbeddableAssignmentModel } from '../src/lti/embeddable/assignment/embeddable-assignment.entity'

describe('EmbeddableAssignment Integration', () => {
  const { supertest } = setupIntegrationTest(EmbeddableModule);

  describe('POST /lti/embeddable-assignment/:courseId', () => {
    it('returns 401 when not logged in', async () => {
      await supertest().post('/lti/embeddable-assignment/1').expect(401);
    });

    it('returns 404 when user is not in course and attempts to access route', async () => {
      const u = await UserFactory.create();
      const c = await CourseFactory.create();

      await supertest({ userId: u.id })
        .post(`/lti/embeddable-assignment/${c.id}`)
        .send({
          name: 'assignment',
          questions: [],
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
        .post(`/lti/embeddable-assignment/${c.id}`)
        .send({
          name: 'assignment',
          questions: [],
        })
        .expect(403)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([Role.TA, Role.PROFESSOR])));
    });

    it('creates an assignment and associated questions', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const existing = await EmbeddableQuestionFactory.create({
        course
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-assignment/${course.id}`)
        .send({
          name: 'assignment',
          questions: [
            {
              order: 0,
              questionId: existing.id,
            },
            {
              order: 1,
              createParams: {
                questionText: 'test',
                criteriaText: 'test',
              }
            }
          ]
        })
        .expect(201)
        .then(res => {
          expect(res.body.name).toEqual('assignment');
          expect(res.body.questions).toHaveLength(2);
          expect(res.body.courseId).toEqual(course.id);
        });
    });

    it('returns 400 when creating without name', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-assignment/${course.id}`)
        .send({ questions: [] })
        .expect(400);
    });

    it('returns 400 when creating without questions', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: ta.userId })
        .post(`/lti/embeddable-assignment/${course.id}`)
        .send({ name: 'assignment', })
        .expect(400);
    });
  });

  describe('GET /lti/embeddable-assignment/:courseId', () => {
    it('returns 403 when a student tries to list assignments', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/lti/embeddable-assignment/${course.id}`)
        .expect(403);
    });

    it('returns all assignments for a course', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await EmbeddableAssignmentFactory.createList(2, { course });

      const res = await supertest({ userId: ta.userId })
        .get(`/lti/embeddable-assignment/${course.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('does not return assignments from other courses', async () => {
      const course1 = await CourseFactory.create();
      const course2 = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course: course1,
        user: await UserFactory.create(),
      });

      await EmbeddableAssignmentFactory.create({
        course: course1,
        name: 'Mine',
      });
      await EmbeddableAssignmentFactory.create({
        course: course2,
        name: 'Not mine',
      });

      const res = await supertest({ userId: ta.userId })
        .get(`/lti/embeddable-assignment/${course1.id}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toEqual('Mine');
    });
  });

  describe('GET /lti/embeddable-assignment/:courseId/:assignmentId', () => {
    it('returns 404 if user is not a member of the course', async () => {
      const u = await UserFactory.create();
      const c = await CourseFactory.create();
      const a = await EmbeddableAssignmentFactory.create({ course: c });
      await supertest({ userId: u.id })
        .get(`/lti/embeddable-assignment/${c.id}/${a.id}`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it.each([Role.STUDENT, Role.TA, Role.PROFESSOR])('allows a %s to retrieve a question', async (role) => {
      const course = await CourseFactory.create();
      const u = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course,
        role,
      })

      const a = await EmbeddableAssignmentFactory.create({
        course,
        name: 'Sample',
      });

      await supertest({ userId: u.userId })
        .get(`/lti/embeddable-assignment/${course.id}/${a.id}`)
        .expect(200)
        .then(res => expect(res.body.name).toEqual('Sample'))
    });

    it('returns 404 for a nonexistent assignment', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.userId })
        .get(`/lti/embeddable-assignment/${course.id}/999`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.embeddableModule.assignmentNotFound));
    });
  });

  describe('POST /lti/embeddable-assignment/:courseId/:assignmentId/:questionId/feedback', () => {
    it('returns 401 if user is not authorized', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      await supertest()
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
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
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
        .send({})
        .expect(400);
    });

    it('returns 400 when responseText is not a string', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
        .send({ responseText: 123 })
        .expect(400);
    });

    it('returns 400 when responseText is only whitespace', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
        .send({ responseText: '   ' })
        .expect(400);
    });

    it('returns a response otherwise', async () => {
      const course = await CourseFactory.create();
      const user = await UserCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });

      const querySpy = jest.spyOn(ChatbotApiService.prototype, 'queryChatbot')
      querySpy.mockResolvedValue('feedback')

      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/${assignment.id}/${question.id}/feedback`)
        .send({ responseText: 'response' })
        .expect(201)
        .then(res => expect(res.body).toEqual({ feedback: 'feedback', grade: null }));

      querySpy.mockClear();
    });
  });

  describe('PATCH /lti/embeddable-assignment/:courseId/:assignmentId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest()
        .patch(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest({ userId: user.id })
        .patch(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
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
      const assignment = await EmbeddableAssignmentFactory.create({ course });

      await supertest({ userId: student.userId })
        .patch(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .send({ questionText: 'Nope', criteriaText: 'Nope' })
        .expect(403);
    });

    it('updates an assignment', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({
        course,
        name: 'Original',
      });

      await supertest({ userId: ta.userId })
        .patch(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .send({ name: 'Updated', questions: [] })
        .expect(200)
        .then((res) => {
          expect(res.body.name).toEqual('Updated');
        });
    });
  });

  describe('DELETE /lti/embeddable-assignment/:courseId/:assignmentId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest()
        .delete(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .send()
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest({ userId: user.id })
        .delete(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
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
      const assignment = await EmbeddableAssignmentFactory.create({ course });

      await supertest({ userId: student.userId })
        .delete(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .expect(403);
    });

    it('deletes an assignment', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });

      await supertest({ userId: ta.userId })
        .delete(`/lti/embeddable-assignment/${course.id}/${assignment.id}`)
        .expect(200);

      const deleted = await EmbeddableAssignmentModel.findOne({
        where: { id: assignment.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('GET /lti/embeddable-assignment/:courseId/answers/:assignmentId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest()
        .get(`/lti/embeddable-assignment/${course.id}/answers/${assignment.id}`)
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      await supertest({ userId: user.id })
        .get(`/lti/embeddable-assignment/${course.id}/answers/${assignment.id}`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to access answers', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });

      await supertest({ userId: student.userId })
        .get(`/lti/embeddable-assignment/${course.id}/answers/${assignment.id}`)
        .expect(403);
    });

    it('returns answers otherwise', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      })
      await EmbeddableAssignmentFeedbackFactory.createList(5, {
        assignmentQuestion
      });

      await supertest({ userId: ta.userId })
        .get(`/lti/embeddable-assignment/${course.id}/answers/${assignment.id}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveLength(5);
        });
    });
  });

  describe('PATCH /lti/embeddable-assignment/:courseId/answers/:answerId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest()
        .patch(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .send({
          humanFeedback: 'feedback',
          humanGrade: 100,
        })
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: user.id })
        .patch(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .send({
          humanFeedback: 'feedback',
          humanGrade: 100,
        })
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to update answer', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: student.id })
        .patch(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .send({
          humanFeedback: 'feedback',
          humanGrade: 100,
        })
        .expect(403);
    });

    it('returns 400 if missing humanGrade', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: ta.userId })
        .patch(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .send({
          humanFeedback: 'feedback',
        })
        .expect(400);
    });

    it('returns updated answer otherwise', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: ta.userId })
        .patch(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .send({
          humanFeedback: 'feedback',
          humanGrade: 100,
        })
        .expect(200)
        .then((res) => {
          expect(pick(res.body,['humanGrade','humanFeedback'])).toEqual({
            humanFeedback: 'feedback',
            humanGrade: 100,
          });
        });
    });
  });

  describe('DELETE /lti/embeddable-assignment/:courseId/answers/:answerId', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });


      await supertest()
        .delete(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: user.id })
        .delete(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to delete answer', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: student.id })
        .delete(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .expect(403);
    });

    it('deletes answer otherwise', async () => {
      const course = await CourseFactory.create();
      const ta = await TACourseFactory.create({
        course,
        user: await UserFactory.create(),
      });
      const assignment = await EmbeddableAssignmentFactory.create({ course });
      const question = await EmbeddableQuestionFactory.create({ course });
      const assignmentQuestion = await EmbeddableAssignmentQuestionFactory.create({
        assignment,
        question,
      });
      const answer = await EmbeddableAssignmentFeedbackFactory.create({ assignmentQuestion });

      await supertest({ userId: ta.userId })
        .delete(`/lti/embeddable-assignment/${course.id}/answers/${answer.id}`)
        .expect(200);

      expect(await EmbeddableQuestionFeedbackModel.findOne({
        where: {
          id: answer.id,
        }
      })).toBeNull();
    });
  });

  describe('POST /lti/embeddable-assignment/:courseId/export', () => {
    it('returns 401 if user is not logged in', async () => {
      const course = await CourseFactory.create();
      await supertest()
        .post(`/lti/embeddable-assignment/${course.id}/export`)
        .expect(401);
    });

    it('returns 404 if user is not in course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await supertest({ userId: user.id })
        .post(`/lti/embeddable-assignment/${course.id}/export`)
        .expect(404)
        .then(res => expect(res.body.message).toEqual(ERROR_MESSAGES.roleGuard.notInCourse));
    });

    it('returns 403 when a student tries to export answers', async () => {
      const course = await CourseFactory.create();
      const student = await StudentCourseFactory.create({
        course,
        user: await UserFactory.create(),
      });

      await supertest({ userId: student.id })
        .post(`/lti/embeddable-assignment/${course.id}/export`)
        .expect(403);
    });
  });
});