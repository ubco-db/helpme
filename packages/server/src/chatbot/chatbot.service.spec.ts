import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ChatbotService } from './chatbot.service';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import {
  UserFactory,
  CourseFactory,
  InteractionFactory,
  initFactoriesFromService,
} from '../../test/util/factories';
import { ChatbotQuestionModel } from './question.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
      providers: [ChatbotService],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
  });

  describe('createInteraction', () => {
    it('should throw an error if course is not found', async () => {
      await expect(service.createInteraction(0, 1)).rejects.toThrow(
        'Course not found based on the provided ID.',
      );
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
      const questionParams = {
        interactionId: interaction.id,
        questionText: "What's the meaning of life?",
        responseText: "It's a philosophical question.",
        suggested: true,
        isPreviousQuestion: false,
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
        suggested: true,
        vectorStoreId: '1',
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        id: originalQuestion.id,
        questionText: 'Updated question',
        responseText: 'Updated response',
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
        suggested: true,
        vectorStoreId: '1',
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        id: originalQuestion.id,
        questionText: 'Updated question',
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
        suggested: true,
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        id: originalQuestion.id,
        interactionId: interaction2.id,
      };

      await service.editQuestion(updatedQuestionData);

      const updatedQuestion = await ChatbotQuestionModel.findOne({
        where: {
          id: originalQuestion.id,
        },
        relations: {
          interaction: true,
        },
      });

      expect(updatedQuestion.interaction.id).toEqual(interaction2.id);
    });
  });
});
