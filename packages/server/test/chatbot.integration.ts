import { ChatbotModule } from 'chatbot/chatbot.module';
import { ChatbotQuestion, Role } from '@koh/common';
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

  it('should create an interaction', async () => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    const interactionData = {
      userId: user.id,
      courseId: course.id,
    };
    await UserCourseFactory.create({
      user: user,
      course: course,
    });
    await supertest({ userId: 1 })
      .post('/chatbot/interaction')
      .send(interactionData)
      .expect(201);
  });

  it('should create a question', async () => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: user,
      course: course,
    });
    const interaction = await InteractionFactory.create({ user, course });

    const questionData: ChatbotQuestion = {
      interactionId: interaction.id,
      questionText: 'How does photosynthesis work?',
      responseText: 'Photosynthesis is the process by which plants...',
      suggested: true,
      userScore: 5,
      vectorStoreId: '1',
    };

    await supertest({ userId: 1 })
      .post('/chatbot/question')
      .send(questionData)
      .expect(201);
  });

  it('should edit a question', async () => {
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: user,
      course: course,
    });
    const interaction = await InteractionFactory.create({ user, course });

    const questionData: DeepPartial<ChatbotQuestion> = {
      interactionId: interaction.id,
      questionText: 'How does photosynthesis work?',
      responseText: 'Photosynthesis is the process by which plants...',
      suggested: true,
      userScore: 5,
    };
    const createdQuestion =
      await ChatbotQuestionModel.create<ChatbotQuestionModel>(
        questionData,
      ).save();
    const editRequestData = {
      data: { userScore: 0, suggested: true },
      questionId: createdQuestion.id,
    };

    await supertest({ userId: 1 })
      .patch('/chatbot/question')
      .send(editRequestData)
      .expect(200);
  });

  it('should not delete a question', async () => {
    const questionId = 1;
    const user = await UserFactory.create();
    const course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: user,
      course: course,
    });
    // no questions created
    await supertest({ userId: 1 })
      .delete('/chatbot/question')
      .send({ questionId })
      .expect(404);
  });
  describe('GET /chatbot/questions/:courseId', () => {
    it('should return 403 if user is not a TA or Professor', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      await supertest({ userId: user.id })
        .get(`/chatbot/questions/${course.id}`)
        .expect(403);
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
      const questionData: ChatbotQuestion = {
        interactionId: interaction.id,
        questionText: 'How does photosynthesis work?',
        responseText: 'Photosynthesis is the process by which plants...',
        suggested: true,
        userScore: 5,
        vectorStoreId: '1',
      };
      await ChatbotQuestionModel.create(questionData).save();
      await supertest({ userId: user.id })
        .get(`/chatbot/questions/${course.id}`)
        .expect(200);
    });
  });
});
