import { ChatbotModule } from 'chatbot/chatbot.module';
import { Role } from '@koh/common';
import {
  InteractionFactory,
  UserFactory,
  CourseFactory,
  UserCourseFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { ChatbotQuestionModel } from 'chatbot/question.entity';

describe('ChatbotController Integration', () => {
  const { supertest } = setupIntegrationTest(ChatbotModule);

  describe('PATCH /chatbot/questionScore/:courseId/:questionId', () => {
    it('should allow a student to update the score of a question', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
      });
      const interaction = await InteractionFactory.create({ user, course });
      const questionData = {
        vectorStoreId: '123',
        questionText: 'How does photosynthesis work?',
        responseText: 'Photosynthesis is the process by which plants...',
        verified: true,
        suggested: true,
        sourceDocuments: [],
        interaction: interaction,
      };
      const question = await ChatbotQuestionModel.create(questionData).save();
      await supertest({ userId: user.id })
        .patch(`/chatbot/questionScore/${course.id}/${question.id}`)
        .send({ userScore: 1 })
        .expect(200);
      const updatedQuestion = await ChatbotQuestionModel.findOne({
        where: { id: question.id },
      });
      expect(updatedQuestion.userScore).toEqual(1);
    });
  });

  describe('GET /chatbot/questions/:courseId', () => {
    it('should return 404 if user is not a TA or Professor', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      await supertest({ userId: user.id })
        .get(`/chatbot/questions/${course.id}`)
        .expect(404);
    });
    it('should return questions for a course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });
      const interaction = await InteractionFactory.create({ user, course });
      const questionData = {
        vectorStoreId: '123',
        questionText: 'How does photosynthesis work?',
        responseText: 'Photosynthesis is the process by which plants...',
        verified: true,
        suggested: true,
        sourceDocuments: [],
        interaction: interaction,
      };
      await ChatbotQuestionModel.create(questionData).save();
      await supertest({ userId: user.id })
        .get(`/chatbot/questions/${course.id}`)
        .expect(200);
    });
  });
});
