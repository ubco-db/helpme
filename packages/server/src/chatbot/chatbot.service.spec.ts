import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ChatbotService } from './chatbot.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import {
  UserFactory,
  CourseFactory,
  InteractionFactory,
} from '../../test/util/factories';
import { ChatbotQuestion } from '@koh/common';
import { ChatbotQuestionModel } from './question.entity';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule],
      providers: [ChatbotService],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('createInteraction', () => {
    it('should throw an error if course is not found', async () => {
      await expect(
        service.createInteraction({ courseId: 0, userId: 1 }),
      ).rejects.toThrow('Course not found based on the provided ID.');
    });

    it('should create an interaction', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const interaction = await InteractionFactory.create({
        user: user,
        course: course,
      });

      expect(interaction).toBeDefined();
      expect(interaction.user).toEqual(user);
      expect(interaction.course).toEqual(course);
    });
  });
  describe('createQuestion', () => {
    it('should create a question with valid properties', async () => {
      const interaction = await InteractionFactory.create();
      const questionParams: ChatbotQuestion = {
        interactionId: interaction.id,
        questionText: "What's the meaning of life?",
        responseText: "It's a philosophical question.",
        suggested: true,
        userScore: 5,
        vectorStoreId: '1',
      };
      const createdQuestion = await service.createQuestion(questionParams);
      expect(createdQuestion).toBeDefined();
      expect(createdQuestion.questionText).toEqual(questionParams.questionText);
      expect(createdQuestion.responseText).toEqual(questionParams.responseText);
    });
  });
  describe('editQuestion', () => {
    it('should throw an error if question is not found', async () => {
      await expect(
        service.editQuestion({ id: 999, userScore: 5 }),
      ).rejects.toThrow('Question not found based on the provided ID.');
    });

    it('should successfully edit an existing question', async () => {
      const interaction = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion({
        interactionId: interaction.id,
        questionText: 'Original question',
        responseText: 'Original response',
        userScore: 3,
        suggested: true,
        vectorStoreId: '1',
      });

      const updatedQuestionData: ChatbotQuestion = {
        id: originalQuestion.id,
        questionText: 'Updated question',
        responseText: 'Updated response',
        userScore: 5,
        suggested: false,
        isPreviousQuestion: true,
        vectorStoreId: '2',
      };

      const updatedQuestion = await service.editQuestion(updatedQuestionData);

      expect(updatedQuestion).toBeDefined();
      expect(updatedQuestion.id).toEqual(originalQuestion.id);
      expect(updatedQuestion.questionText).toEqual(
        updatedQuestionData.questionText,
      );
      expect(updatedQuestion.responseText).toEqual(
        updatedQuestionData.responseText,
      );
      expect(updatedQuestion.userScore).toEqual(updatedQuestionData.userScore);
      expect(updatedQuestion.suggested).toEqual(updatedQuestionData.suggested);
      expect(updatedQuestion.isPreviousQuestion).toEqual(
        updatedQuestionData.isPreviousQuestion,
      );
      expect(updatedQuestion.vectorStoreId).toEqual(
        updatedQuestionData.vectorStoreId,
      );
    });

    it('should only update provided fields', async () => {
      const interaction = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion({
        interactionId: interaction.id,
        questionText: 'Original question',
        responseText: 'Original response',
        userScore: 3,
        suggested: true,
        vectorStoreId: '1',
      });

      const updatedQuestionData: ChatbotQuestion = {
        id: originalQuestion.id,
        questionText: 'Updated question',
        userScore: 4,
      };

      const updatedQuestion = await service.editQuestion(updatedQuestionData);

      expect(updatedQuestion).toBeDefined();
      expect(updatedQuestion.id).toEqual(originalQuestion.id);
      expect(updatedQuestion.questionText).toEqual(
        updatedQuestionData.questionText,
      );
      expect(updatedQuestion.responseText).toEqual(
        originalQuestion.responseText,
      );
      expect(updatedQuestion.userScore).toEqual(updatedQuestionData.userScore);
      expect(updatedQuestion.suggested).toEqual(originalQuestion.suggested);
      expect(updatedQuestion.vectorStoreId).toEqual(
        originalQuestion.vectorStoreId,
      );
    });

    it('should allow updating the interactionId', async () => {
      const interaction1 = await InteractionFactory.create();
      const interaction2 = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion({
        interactionId: interaction1.id,
        vectorStoreId: '1',
        questionText: 'Original question',
        responseText: 'Original response',
        userScore: 3,
      });

      const updatedQuestionData: ChatbotQuestion = {
        id: originalQuestion.id,
        interactionId: interaction2.id,
        userScore: 3,
      };

      await service.editQuestion(updatedQuestionData);

      const updatedQuestion = await ChatbotQuestionModel.findOne(
        originalQuestion.id,
        { relations: ['interaction'] },
      );

      expect(updatedQuestion.interaction.id).toEqual(interaction2.id);
    });
  });
});
