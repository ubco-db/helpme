import { ChatbotModule } from 'chatbot/chatbot.module';
import { ChatbotAskSuggestedParams, Role } from '@koh/common';
import {
  InteractionFactory,
  UserFactory,
  CourseFactory,
  UserCourseFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { ChatbotQuestionModel } from 'chatbot/question.entity';
import { DeepPartial } from 'typeorm';

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

  describe('GET /chatbot/question/all/:courseId', () => {
    it('should return 404 if user is not a TA or Professor', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
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
        .get(`/chatbot/question/all/${course.id}`)
        .expect(403);
    });
  });

  describe('POST /chatbot/askSuggested/:courseId', () => {
    it('Should return 404 if the user is not in the course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await supertest({ userId: user.id })
        .post(`/chatbot/askSuggested/${course.id}`)
        .expect(404);
    });
    it('should allow a student to ask a suggested question', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });

      const body: ChatbotAskSuggestedParams = {
        question: 'How does photosynthesis work?',
        responseText: 'Photosynthesis is the process by which plants...',
        vectorStoreId: '123',
      };

      const response = await supertest({ userId: user.id })
        .post(`/chatbot/askSuggested/${course.id}`)
        .send(body)
        .expect(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.questionText).toEqual(body.question);
      expect(response.body.responseText).toEqual(body.responseText);
      expect(response.body.vectorStoreId).toEqual(body.vectorStoreId);
      expect(response.body.interactionId).toBeDefined();
    });
  });
});
