import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ChatbotService, openAIModels } from './chatbot.service';
import {
  TestChatbotDataSourceModule,
  TestConfigModule,
  TestTypeOrmModule,
} from '../../test/util/testUtils';
import {
  ChatbotProviderFactory,
  CourseChatbotSettingsFactory,
  CourseFactory,
  initFactoriesFromService,
  InteractionFactory,
  LLMTypeFactory,
  OrganizationChatbotSettingsFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  UserFactory,
} from '../../test/util/factories';
import { ChatbotQuestionModel } from './chatbot-question.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { OrganizationChatbotSettingsModel } from './chatbot-infrastructure-models/organization-chatbot-settings.entity';
import { OrganizationModel } from '../organization/organization.entity';
import { CourseModel } from '../course/course.entity';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  ChatbotServiceProvider,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  dropUndefined,
  ERROR_MESSAGES,
  OrganizationChatbotSettingsDefaults,
  UpdateChatbotProviderBody,
  UpdateLLMTypeBody,
  UpsertCourseChatbotSettings,
} from '@koh/common';
import { ChatbotProviderModel } from './chatbot-infrastructure-models/chatbot-provider.entity';
import { pick } from 'lodash';
import { CourseChatbotSettingsModel } from './chatbot-infrastructure-models/course-chatbot-settings.entity';
import { ChatbotSettingsSubscriber } from './chatbot-infrastructure-models/chatbot-settings.subscriber';
import {
  ChatbotDataSourceService,
  chatbotTables,
} from './chatbot-datasource/chatbot-datasource.service';
import { ChatbotApiService } from './chatbot-api.service';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  reset: jest.fn(),
};

describe('ChatbotService', () => {
  let service: ChatbotService;
  let subscriber: ChatbotSettingsSubscriber;
  let dataSource: DataSource;
  let chatbotDataSourceService: ChatbotDataSourceService;

  let organization0: OrganizationModel;
  let organization1: OrganizationModel;
  let courses0: CourseModel[] = [];
  let courses1: CourseModel[] = [];
  let course0: CourseModel;
  let course1: CourseModel;

  let orgSettings: OrganizationChatbotSettingsModel;
  let providers: ChatbotProviderModel[] = [];

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        TestChatbotDataSourceModule,
        FactoryModule,
      ],
      providers: [
        ChatbotService,
        ChatbotApiService,
        ChatbotSettingsSubscriber,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    dataSource = module.get<DataSource>(DataSource);
    chatbotDataSourceService = module.get<ChatbotDataSourceService>(
      ChatbotDataSourceService,
    );
    subscriber = module.get<ChatbotSettingsSubscriber>(
      ChatbotSettingsSubscriber,
    );

    await chatbotDataSourceService.initializeTestSchema();

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  let updateChatbotRepositorySpy: jest.SpyInstance;

  beforeEach(() => {
    updateChatbotRepositorySpy = jest.spyOn(
      subscriber,
      'updateChatbotRepository',
    );
  });

  afterEach(() => {
    chatbotDataSourceService.getDataSource().then(() => {
      Promise.allSettled(
        chatbotTables.map(async (table) => {
          await chatbotDataSourceService.clearTable(table);
        }),
      ).then();
    });
    updateChatbotRepositorySpy.mockRestore();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
    organization0 = await OrganizationFactory.create({
      id: 1,
    });
    organization1 = await OrganizationFactory.create({
      id: 2,
    });
    courses0 = [];
    courses1 = [];
    for (let i = 1; i <= 5; i++) {
      courses0.push(await CourseFactory.create());
      courses1.push(await CourseFactory.create());
      courses0[i - 1].organizationCourse =
        await OrganizationCourseFactory.create({
          organization: organization0,
          course: courses0[i - 1],
        });
      courses1[i - 1].organizationCourse =
        await OrganizationCourseFactory.create({
          organization: organization1,
          course: courses1[i - 1],
        });
    }
    course0 = courses0[0];
    course1 = courses1[0];

    orgSettings = await OrganizationChatbotSettingsFactory.create({
      organization: organization0,
    });
    providers = [];
    providers.push(
      await ChatbotProviderFactory.create({
        organizationChatbotSettings: orgSettings,
        providerType: ChatbotServiceProvider.Ollama,
        baseUrl: 'https://fake-url.com',
      }),
    );
    providers.push(
      await ChatbotProviderFactory.create({
        organizationChatbotSettings: orgSettings,
        providerType: ChatbotServiceProvider.OpenAI,
        apiKey: 'abcdefghijklmnop',
      }),
    );
    for (const provider of providers) {
      const sets: {
        isText: boolean;
        isThinking: boolean;
        isVision: boolean;
      }[] = [
        {
          isText: true,
          isThinking: false,
          isVision: false,
        },
        {
          isText: true,
          isThinking: true,
          isVision: false,
        },
        {
          isText: true,
          isThinking: true,
          isVision: true,
        },
        {
          isText: true,
          isThinking: false,
          isVision: true,
        },
      ];
      provider.availableModels = await Promise.all(
        sets.map(
          async (set, i) =>
            await LLMTypeFactory.create({
              provider,
              modelName: `model${i + 1}`,
              ...set,
            }),
        ),
      );
      const textModel = provider.availableModels.find((m) => m.isText == true);
      provider.defaultModelId = textModel.id;
      provider.defaultModel = textModel;
      const visionModel = provider.availableModels.find(
        (m) => m.isVision == true,
      );
      provider.defaultVisionModelId = visionModel.id;
      provider.defaultVisionModel = visionModel;
      await provider.save();
    }
    orgSettings.providers = providers;
    orgSettings.defaultProviderId = providers[0].id;
    await orgSettings.save();
    orgSettings = await OrganizationChatbotSettingsModel.findOne({
      where: { id: orgSettings.id },
      relations: {
        providers: true,
        defaultProvider: {
          defaultModel: true,
          defaultVisionModel: true,
        },
      },
    });
    for (const course of courses0) {
      await CourseChatbotSettingsFactory.create({
        organizationSettings: orgSettings,
        course,
        llmModel: providers[0].defaultModel,
      });
      updateChatbotRepositorySpy.mockClear();
    }
  });

  let originalFetch: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch?.mockClear();
    global.fetch = originalFetch;
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
        questionText: "What's the meaning of life?",
        responseText: "It's a philosophical question.",
        suggested: true,
        isPreviousQuestion: false,
        vectorStoreId: '1',
      };
      const createdQuestion = await service.createQuestion(
        interaction.id,
        questionParams,
      );
      expect(createdQuestion).toBeDefined();
    });
  });

  describe('editQuestion', () => {
    it('should throw an error if question is not found', async () => {
      await expect(service.editQuestion(999, { userScore: 5 })).rejects.toThrow(
        'Question not found based on the provided ID.',
      );
    });

    it('should successfully edit an existing question', async () => {
      const interaction = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion(interaction.id, {
        vectorStoreId: '1',
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        isPreviousQuestion: true,
        vectorStoreId: '2',
      };

      const updatedQuestion = await service.editQuestion(
        originalQuestion.id,
        updatedQuestionData,
      );

      expect(updatedQuestion).toBeDefined();
      expect(updatedQuestion.id).toEqual(originalQuestion.id);
      expect(updatedQuestion.isPreviousQuestion).toEqual(
        updatedQuestionData.isPreviousQuestion,
      );
      expect(updatedQuestion.vectorStoreId).toEqual(
        updatedQuestionData.vectorStoreId,
      );
    });

    it('should only update provided fields', async () => {
      const interaction = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion(interaction.id, {
        vectorStoreId: '1',
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        isPreviousQuestion: true,
      };

      const updatedQuestion = await service.editQuestion(
        originalQuestion.id,
        updatedQuestionData,
      );

      expect(updatedQuestion).toBeDefined();
      expect(updatedQuestion.id).toEqual(originalQuestion.id);
      expect(updatedQuestion.isPreviousQuestion).toEqual(
        updatedQuestionData.isPreviousQuestion,
      );
      expect(updatedQuestion.vectorStoreId).toEqual(
        originalQuestion.vectorStoreId,
      );
    });

    it('should allow updating the interactionId', async () => {
      const interaction1 = await InteractionFactory.create();
      const interaction2 = await InteractionFactory.create();
      const originalQuestion = await service.createQuestion(interaction1.id, {
        vectorStoreId: '1',
        isPreviousQuestion: false,
      });

      const updatedQuestionData = {
        interactionId: interaction2.id,
      };

      await service.editQuestion(originalQuestion.id, updatedQuestionData);

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

  describe('isChatbotServiceLegacy', () => {
    it.each([
      [false, ' '],
      [true, ' not '],
    ])(
      'should return %o when organization chatbot settings is%sreal',
      async (bool) => {
        const organization = await OrganizationFactory.create();
        const course = await CourseFactory.create();
        const organizationCourse = await OrganizationCourseFactory.create({
          course,
          organization,
        });
        if (!bool) {
          await OrganizationChatbotSettingsFactory.create({
            organization,
          });
        }
        expect(
          await service.isChatbotServiceLegacy(organizationCourse.courseId),
        ).toStrictEqual(bool);
      },
    );
  });

  describe('createOrganizationSettings', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it.each([{ providers: [] }, { providers: undefined }])(
      'should fail if providers parameter is %s',
      async ({ providers }) => {
        await expect(
          service.createOrganizationSettings(organization0.id, { providers }),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.providersRequired,
          ),
        );
      },
    );

    it('should create organization settings, providers, and models by extension, then backfill course settings', async () => {
      const params: CreateOrganizationChatbotSettingsBody = {
        defaultProvider: 0,
        default_prompt: 'This is a prompt',
        default_temperature: 0.5,
        default_topK: 3,
        default_similarityThresholdDocuments: 0.9,
        default_similarityThresholdQuestions: 0.5,
        providers: [
          {
            providerType: ChatbotServiceProvider.Ollama,
            baseUrl: 'https://fake-url.com/',
            defaultModelName: 'model1',
            defaultVisionModelName: 'model2',
            models: [
              {
                modelName: 'model1',
                isRecommended: false,
                isText: true,
                isVision: false,
                isThinking: false,
              },
              {
                modelName: 'model2',
                isRecommended: false,
                isText: true,
                isVision: true,
                isThinking: false,
              },
            ],
          },
          {
            providerType: ChatbotServiceProvider.OpenAI,
            apiKey: 'abcdefghijklmnop',
            defaultModelName: 'model1',
            defaultVisionModelName: 'model2',
            models: [
              {
                modelName: 'model1',
                isRecommended: false,
                isText: true,
                isVision: false,
                isThinking: false,
              },
              {
                modelName: 'model2',
                isRecommended: false,
                isText: true,
                isVision: true,
                isThinking: false,
              },
            ],
          },
        ],
      };

      const result = await service.createOrganizationSettings(
        organization1.id,
        { ...params },
      );
      Object.keys(params)
        .filter((k) => k != 'providers' && k != 'defaultProvider')
        .forEach((k) => {
          expect(result[k as keyof OrganizationChatbotSettingsModel]).toEqual(
            params[k as keyof CreateOrganizationChatbotSettingsBody],
          );
        });
      params.providers.forEach((provider) => {
        const resultProvider = result.providers.find(
          (p) => p.providerType == provider.providerType,
        );
        expect(resultProvider).not.toBeUndefined();
        Object.keys(provider)
          .filter(
            (k) =>
              ![
                'defaultModelName',
                'defaultVisionModelName',
                'models',
              ].includes(k),
          )
          .forEach((k) => {
            expect(resultProvider[k as keyof ChatbotProviderModel]).toEqual(
              provider[k as keyof CreateChatbotProviderBody],
            );
          });
        provider.models.forEach((model) => {
          const resultModel = resultProvider.availableModels.find(
            (m) => m.modelName == model.modelName,
          );
          expect(resultModel).not.toBeUndefined();
          if (model.modelName == provider.defaultModelName) {
            expect(resultProvider.defaultModelId).toEqual(resultModel.id);
          }
          if (model.modelName == provider.defaultVisionModelName) {
            expect(resultProvider.defaultVisionModelId).toEqual(resultModel.id);
          }
          Object.keys(model).forEach((k) => {
            expect(resultModel[k as keyof CreateLLMTypeBody]).toEqual(
              model[k as keyof CreateLLMTypeBody],
            );
          });
        });
      });

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
        4 * courses1.length,
      );
      for (const course of courses1) {
        const courseSetting = await CourseChatbotSettingsModel.findOne({
          where: {
            courseId: course.id,
          },
          relations: {
            llmModel: {
              provider: {
                defaultModel: true,
                defaultVisionModel: true,
              },
            },
            organizationSettings: {
              defaultProvider: {
                defaultModel: true,
                defaultVisionModel: true,
              },
            },
          },
        });
        expect(courseSetting).not.toBeUndefined();
        expect(
          pick(courseSetting, [
            'llmId',
            'prompt',
            'temperature',
            'topK',
            'similarityThresholdDocuments',
            'similarityThresholdQuestions',
            'usingDefaultModel',
            'usingDefaultPrompt',
            'usingDefaultTemperature',
            'usingDefaultTopK',
            'usingDefaultSimilarityThresholdDocuments',
            'usingDefaultSimilarityThresholdQuestions',
          ]),
        ).toEqual({
          llmId: result.defaultProvider.defaultModelId,
          prompt: result.default_prompt,
          temperature: result.default_temperature,
          topK: result.default_topK,
          similarityThresholdDocuments:
            result.default_similarityThresholdDocuments,
          similarityThresholdQuestions:
            result.default_similarityThresholdQuestions,
          usingDefaultModel: true,
          usingDefaultPrompt: true,
          usingDefaultTemperature: true,
          usingDefaultTopK: true,
          usingDefaultSimilarityThresholdDocuments: true,
          usingDefaultSimilarityThresholdQuestions: true,
        });
        const chatbotDataSource =
          await chatbotDataSourceService.getDataSource();
        const chatbotSide = await chatbotDataSource.query(
          `
          SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
          [course.id],
        );
        expect(chatbotSide).toEqual([
          {
            ...courseSetting.getMetadata(),
            courseId: course.id,
          },
        ]);
      }
    });
  });

  describe('createChatbotProvider', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it.each(['text', 'vision'])(
      'should fail to create if default %s model is not found in list',
      async (model) => {
        const settings = await OrganizationChatbotSettingsFactory.create({
          id: 1,
        });
        const params: CreateChatbotProviderBody = {
          providerType: ChatbotServiceProvider.Ollama,
          baseUrl: 'https://fake-url.com/',
          defaultModelName: model == 'text' ? 'model3' : 'model1',
          defaultVisionModelName: model == 'vision' ? 'model3' : 'model2',
          models: [
            {
              modelName: 'model1',
              isRecommended: false,
              isText: true,
              isVision: false,
              isThinking: false,
            },
            {
              modelName: 'model2',
              isRecommended: false,
              isText: true,
              isVision: true,
              isThinking: false,
            },
          ],
        };

        await expect(
          service.createChatbotProvider(settings, params),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.defaultModelNotFound,
          ),
        );
      },
    );

    it('should create chatbot provider, and models by extension', async () => {
      const settings = await OrganizationChatbotSettingsFactory.create({
        id: 1,
      });
      const params: CreateChatbotProviderBody = {
        providerType: ChatbotServiceProvider.Ollama,
        baseUrl: 'https://fake-url.com/',
        defaultModelName: 'model1',
        defaultVisionModelName: 'model2',
        models: [
          {
            modelName: 'model1',
            isRecommended: false,
            isText: true,
            isVision: false,
            isThinking: false,
          },
          {
            modelName: 'model2',
            isRecommended: false,
            isText: true,
            isVision: true,
            isThinking: false,
          },
        ],
      };
      const result = await service.createChatbotProvider(settings, {
        ...params,
      });
      expect(result).not.toBeUndefined();
      Object.keys(params)
        .filter(
          (k) =>
            !['defaultModelName', 'defaultVisionModelName', 'models'].includes(
              k,
            ),
        )
        .forEach((k) => {
          expect(result[k as keyof ChatbotProviderModel]).toEqual(
            params[k as keyof CreateChatbotProviderBody],
          );
        });

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
        2 * courses0.length,
      );
      params.models.forEach((model) => {
        const resultModel = result.availableModels.find(
          (m) => m.modelName == model.modelName,
        );
        expect(resultModel).not.toBeUndefined();
        if (model.modelName == params.defaultModelName) {
          expect(result.defaultModelId).toEqual(resultModel.id);
        }
        if (model.modelName == params.defaultVisionModelName) {
          expect(result.defaultVisionModelId).toEqual(resultModel.id);
        }
        Object.keys(model).forEach((k) => {
          expect(resultModel[k as keyof CreateLLMTypeBody]).toEqual(
            model[k as keyof CreateLLMTypeBody],
          );
        });
      });
    });
  });

  describe('createLLMType', () => {
    it('should create LLM type', async () => {
      const provider = await ChatbotProviderFactory.create();
      const params: CreateLLMTypeBody = {
        providerId: provider.id,
        modelName: 'model1',
        isRecommended: false,
        isText: true,
        isVision: false,
        isThinking: false,
      };
      const result = await service.createLLMType(params);

      expect(result).not.toBeUndefined();
      Object.keys(params).forEach((k) => {
        expect(result[k as keyof CreateLLMTypeBody]).toEqual(
          params[k as keyof CreateLLMTypeBody],
        );
      });
    });
  });

  describe('updateOrganizationSettings', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it('should update organization settings', async () => {
      const params: OrganizationChatbotSettingsDefaults = {
        defaultProvider: providers[1].id,
        default_prompt: 'new prompt',
        default_temperature: 0.5,
        default_topK: 3,
        default_similarityThresholdDocuments: 0.9,
        default_similarityThresholdQuestions: 0.2,
      };
      const updated = await service.updateOrganizationSettings(orgSettings, {
        ...params,
      });
      delete params.defaultProvider;
      expect(
        pick(updated, [
          'defaultProviderId',
          'default_prompt',
          'default_temperature',
          'default_topK',
          'default_similarityThresholdDocuments',
          'default_similarityThresholdQuestions',
        ]),
      ).toEqual({
        ...params,
        defaultProviderId: providers[1].id,
      });
      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
    });
  });

  describe('updateChatbotProvider', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it('should fail if attempting to delete a default model', async () => {
      const provider = providers[0];
      await expect(
        service.updateChatbotProvider(provider, {
          deletedModels: [provider.defaultModelId],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          ERROR_MESSAGES.chatbotService.cannotDeleteDefaultModel,
        ),
      );

      await expect(
        service.updateChatbotProvider(provider, {
          deletedModels: [provider.defaultVisionModelId],
        }),
      ).rejects.toThrow(
        new BadRequestException(
          ERROR_MESSAGES.chatbotService.cannotDeleteDefaultModel,
        ),
      );
    });

    it('should update chatbot provider', async () => {
      const provider = providers[0];
      const textModel = provider.availableModels.find(
        (m) => m.modelName == 'model1',
      );
      const visionModel = provider.availableModels.find(
        (m) => m.modelName == 'model3',
      );
      const newTextModel = provider.availableModels.find(
        (m) => m.modelName == 'model2',
      );
      const newVisionModel = provider.availableModels.find(
        (m) => m.modelName == 'model4',
      );

      const params: UpdateChatbotProviderBody = {
        providerType:
          provider.providerType == ChatbotServiceProvider.Ollama
            ? ChatbotServiceProvider.OpenAI
            : ChatbotServiceProvider.Ollama,
        nickname: 'new nickname',
        headers: { Authorization: 'Bearer fake-token' },
        baseUrl: 'https://new-url.com',
        apiKey: 'zyxnotarealkey',
        defaultModelName: 'model2',
        defaultVisionModelName: 'model4',
        deletedModels: [textModel.id, visionModel.id],
        addedModels: [
          {
            modelName: 'model5',
            isRecommended: false,
            isText: true,
            isVision: false,
            isThinking: false,
          },
          {
            modelName: 'model6',
            isRecommended: false,
            isText: true,
            isVision: false,
            isThinking: false,
          },
        ],
      };

      const updated = await service.updateChatbotProvider(provider, {
        ...params,
      });
      expect(
        pick(updated, [
          'providerType',
          'nickname',
          'headers',
          'apiKey',
          'baseUrl',
          'defaultModelId',
          'defaultVisionModelId',
        ]),
      ).toEqual({
        ...pick(params, [
          'providerType',
          'nickname',
          'headers',
          'apiKey',
          'baseUrl',
        ]),
        defaultModelId: newTextModel.id,
        defaultVisionModelId: newVisionModel.id,
      });
      params.addedModels
        .map((m) => m.modelName)
        .forEach((name) =>
          expect(
            updated.availableModels.find((m) => m.modelName == name),
          ).not.toBeUndefined(),
        );
      params.deletedModels.forEach((id) =>
        expect(updated.availableModels.find((m) => m.id == id)).toBeUndefined(),
      );
      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
        4 * courses0.length,
      );
    });
  });

  describe('updateLLMType', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it.each([false, true])(
      'should update llm type',
      async (useEntityManager: boolean) => {
        const model = providers[0].availableModels[0];
        const params: UpdateLLMTypeBody = {
          modelName: 'new-model',
          isText: !model.isText,
          isThinking: !model.isThinking,
          isVision: !model.isVision,
        };
        const updated = await service.updateLLMType(
          model,
          params,
          useEntityManager ? dataSource.createQueryRunner().manager : undefined,
        );
        expect(
          pick(updated, ['modelName', 'isText', 'isThinking', 'isVision']),
        ).toEqual({
          ...params,
        });

        expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
          courses0.length,
        );
      },
    );
  });

  describe('deleteOrganizationSettings', () => {
    it('should delete the organization settings', async () => {
      await service.deleteOrganizationSettings(organization0.id);
      expect(
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
        }),
      ).toBeFalsy();
    });
  });

  describe('deleteChatbotProvider', () => {
    it.each([false, true])(
      'should fail if its the only provider (using entity manager = %o)',
      async (useEntityManager: boolean) => {
        const orgSetting = await OrganizationChatbotSettingsFactory.create();
        const provider = await ChatbotProviderFactory.create({
          organizationChatbotSettings: orgSetting,
        });
        await expect(
          service.deleteChatbotProvider(
            provider.id,
            useEntityManager
              ? dataSource.createQueryRunner().manager
              : undefined,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.cannotDeleteDefaultProvider,
          ),
        );
      },
    );

    it.each([false, true])(
      'should fail if its the default provider (using entity manager = %o)',
      async (useEntityManager: boolean) => {
        const orgSetting = await OrganizationChatbotSettingsFactory.create();
        const provider0 = await ChatbotProviderFactory.create({
          organizationChatbotSettings: orgSetting,
        });
        await ChatbotProviderFactory.create({
          organizationChatbotSettings: orgSetting,
        });
        orgSetting.defaultProviderId = provider0.id;
        await orgSetting.save();
        await expect(
          service.deleteChatbotProvider(
            provider0.id,
            useEntityManager
              ? dataSource.createQueryRunner().manager
              : undefined,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.cannotDeleteDefaultProvider,
          ),
        );
      },
    );

    it.each([false, true])(
      "should delete the provider and replace its models with the default provider in course's organization settings (using entity manager = %o)",
      async (useEntityManager: boolean) => {
        const provider = providers[1];
        await service.deleteChatbotProvider(
          provider.id,
          useEntityManager ? dataSource.createQueryRunner().manager : undefined,
        );

        expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
          courses0.length,
        );
        for (const course of courses0) {
          const setting = await CourseChatbotSettingsModel.findOne({
            where: { courseId: course.id },
          });
          expect(setting.llmId).not.toEqual(provider.defaultModelId);
          expect(setting.llmId).toEqual(
            orgSettings.defaultProvider.defaultModelId,
          );
        }
      },
    );
  });

  describe('deleteLLMType', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it.each([false, true])(
      'should fail if it is the default text model for its provider (using entity manager = %o)',
      async (useEntityManager: boolean) => {
        const provider = providers[0];
        await expect(
          service.deleteLLMType(
            provider.defaultModelId,
            useEntityManager
              ? dataSource.createQueryRunner().manager
              : undefined,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.cannotDeleteDefaultModel,
          ),
        );
      },
    );

    it.each([false, true])(
      'should fail if it is the default vision model for its provider (using entity manager = %o)',
      async (useEntityManager: boolean) => {
        const provider = providers[0];
        await expect(
          service.deleteLLMType(
            provider.defaultVisionModelId,
            useEntityManager
              ? dataSource.createQueryRunner().manager
              : undefined,
          ),
        ).rejects.toThrow(
          new BadRequestException(
            ERROR_MESSAGES.chatbotService.cannotDeleteDefaultModel,
          ),
        );
      },
    );

    it.each([false, true])(
      'should delete and update any effected courses with its providers default model (using entity manager = %o)',
      async (useEntityManager: boolean) => {
        const provider = providers[0];
        const llmType = provider.availableModels.find(
          (m) =>
            m.id != provider.defaultModelId &&
            m.id != provider.defaultVisionModelId,
        );
        for (const course of courses0) {
          await CourseChatbotSettingsModel.update(
            {
              courseId: course.id,
            },
            {
              llmModel: llmType,
            },
          );
        }
        updateChatbotRepositorySpy.mockClear();

        await service.deleteLLMType(
          llmType.id,
          useEntityManager ? dataSource.createQueryRunner().manager : undefined,
        );

        expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(
          courses0.length,
        );
        for (const course of courses0) {
          const setting = await CourseChatbotSettingsModel.findOne({
            where: { courseId: course.id },
          });
          expect(setting.llmId).not.toEqual(llmType.id);
          expect(setting.llmId).toEqual(provider.defaultModelId);
        }
      },
    );
  });

  describe('upsertCourseSettings', () => {
    let updateSpy: jest.SpyInstance;
    let createSpy: jest.SpyInstance;

    beforeEach(() => {
      updateSpy = jest.spyOn(CourseChatbotSettingsModel, 'update');
      createSpy = jest.spyOn(CourseChatbotSettingsModel, 'save');
    });

    afterEach(async () => {
      updateSpy.mockRestore();
      createSpy.mockRestore();
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it('should create if settings dont already exist', async () => {
      const courseDefaults = CourseChatbotSettingsModel.getDefaults(
        dataSource.manager,
      );
      const orgDefaults = orgSettings.transformDefaults();
      const defaults = {
        ...courseDefaults,
        ...dropUndefined(orgDefaults),
      };
      const provider = providers[0];
      const llmType = provider.availableModels.find(
        (m) =>
          m.id != provider.defaultModelId &&
          m.id != provider.defaultVisionModelId,
      );
      const params: UpsertCourseChatbotSettings = {
        llmId: llmType.id,
        prompt: 'new course-specific prompt',
        temperature: 0.6,
        topK: 2,
        similarityThresholdDocuments: 0.3,
      };
      await CourseChatbotSettingsModel.delete({ courseId: course0.id });

      const result = await service.upsertCourseSetting(
        orgSettings,
        course0.id,
        params,
      );

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
      const chatbotDataSource = await chatbotDataSourceService.getDataSource();
      const chatbotSide = await chatbotDataSource.query(
        `
          SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
        [course0.id],
      );
      result.organizationSettings =
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
          relations: {
            defaultProvider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        });
      expect(chatbotSide).toEqual([
        {
          courseId: course0.id,
          ...result.getMetadata(),
        },
      ]);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).not.toHaveBeenCalled();
      expect(
        pick(result, [
          'llmId',
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ]),
      ).toEqual({
        ...params,
        similarityThresholdQuestions: defaults.similarityThresholdQuestions,
        usingDefaultModel: false,
        usingDefaultPrompt: false,
        usingDefaultTemperature: false,
        usingDefaultTopK: false,
        usingDefaultSimilarityThresholdDocuments: false,
        usingDefaultSimilarityThresholdQuestions: true,
      });
    });

    it('should update if settings already exists', async () => {
      const courseDefaults = CourseChatbotSettingsModel.getDefaults(
        dataSource.manager,
      );
      const orgDefaults = orgSettings.transformDefaults();
      const defaults = {
        ...courseDefaults,
        ...dropUndefined(orgDefaults),
      };

      const provider = providers[0];
      const llmType = provider.availableModels.find(
        (m) =>
          m.id != provider.defaultModelId &&
          m.id != provider.defaultVisionModelId,
      );
      await CourseChatbotSettingsModel.update(
        {
          courseId: course0.id,
        },
        {
          llmModel: provider.defaultModel,
          prompt: 'course-specific prompt',
          temperature: 0.5,
          topK: 3,
          similarityThresholdDocuments: 0.4,
          similarityThresholdQuestions: 0.3,
          usingDefaultModel: true,
          usingDefaultPrompt: true,
          usingDefaultTemperature: true,
          usingDefaultTopK: true,
          usingDefaultSimilarityThresholdDocuments: true,
          usingDefaultSimilarityThresholdQuestions: true,
        },
      );
      updateChatbotRepositorySpy.mockClear();
      updateSpy.mockClear();

      const params: UpsertCourseChatbotSettings = {
        llmId: llmType.id,
        prompt: 'new course-specific prompt',
        temperature: 0.6,
        topK: 2,
        similarityThresholdDocuments: 0.3,
      };
      const result = await service.upsertCourseSetting(
        orgSettings,
        course0.id,
        params,
      );

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
      result.organizationSettings =
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
          relations: {
            defaultProvider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        });
      const chatbotDataSource = await chatbotDataSourceService.getDataSource();
      const chatbotSide = await chatbotDataSource.query(
        `
        SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
        [course0.id],
      );
      expect(chatbotSide).toEqual([
        {
          courseId: course0.id,
          ...result.getMetadata(),
        },
      ]);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).not.toHaveBeenCalled();
      expect(
        pick(result, [
          'llmId',
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ]),
      ).toEqual({
        ...params,
        similarityThresholdQuestions: defaults.similarityThresholdQuestions,
        usingDefaultModel: false,
        usingDefaultPrompt: false,
        usingDefaultTemperature: false,
        usingDefaultTopK: false,
        usingDefaultSimilarityThresholdDocuments: false,
        usingDefaultSimilarityThresholdQuestions: true,
      });
    });

    it("should correctly set 'usingDefault...' properties if properties are equivalent to defaults", async () => {
      const courseDefaults = CourseChatbotSettingsModel.getDefaults(
        dataSource.manager,
      );
      const orgDefaults = orgSettings.transformDefaults();
      const defaults = {
        ...courseDefaults,
        ...dropUndefined(orgDefaults),
      };
      const createResult = await service.upsertCourseSetting(
        orgSettings,
        course0.id,
        {},
      );
      expect(
        pick(createResult, [
          'llmId',
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ]),
      ).toEqual({
        ...defaults,
        usingDefaultModel: true,
        usingDefaultPrompt: true,
        usingDefaultTemperature: true,
        usingDefaultTopK: true,
        usingDefaultSimilarityThresholdDocuments: true,
        usingDefaultSimilarityThresholdQuestions: true,
      });

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
      createResult.organizationSettings =
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
          relations: {
            defaultProvider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        });
      const chatbotDataSource = await chatbotDataSourceService.getDataSource();
      let chatbotSide = await chatbotDataSource.query(
        `
            SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
        [course0.id],
      );
      expect(chatbotSide).toEqual([
        {
          courseId: course0.id,
          ...createResult.getMetadata(),
        },
      ]);

      await CourseChatbotSettingsModel.update(
        { id: createResult.id },
        {
          usingDefaultModel: false,
          usingDefaultPrompt: false,
          usingDefaultTemperature: false,
          usingDefaultTopK: false,
          usingDefaultSimilarityThresholdDocuments: false,
          usingDefaultSimilarityThresholdQuestions: false,
        },
      );
      updateChatbotRepositorySpy.mockClear();

      const updateResult = await service.upsertCourseSetting(
        orgSettings,
        course0.id,
        {},
      );
      expect(
        pick(updateResult, [
          'llmId',
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ]),
      ).toEqual({
        ...defaults,
        usingDefaultModel: true,
        usingDefaultPrompt: true,
        usingDefaultTemperature: true,
        usingDefaultTopK: true,
        usingDefaultSimilarityThresholdDocuments: true,
        usingDefaultSimilarityThresholdQuestions: true,
      });

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
      updateResult.organizationSettings =
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
          relations: {
            defaultProvider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        });
      chatbotSide = await chatbotDataSource.query(
        `
            SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
        [course0.id],
      );
      expect(chatbotSide).toEqual([
        {
          courseId: course0.id,
          ...updateResult.getMetadata(),
        },
      ]);
    });
  });

  describe('resetCourseSettings', () => {
    afterEach(async () => {
      await chatbotDataSourceService
        .clearTable('course_setting')
        .catch(() => undefined);
      updateChatbotRepositorySpy.mockClear();
    });

    it('should fail if course settings not found', async () => {
      await expect(service.resetCourseSetting(course1.id)).rejects.toThrow(
        new NotFoundException(
          ERROR_MESSAGES.chatbotService.courseSettingsNotFound,
        ),
      );
    });

    it('should reset params to defaults', async () => {
      const courseDefaults = CourseChatbotSettingsModel.getDefaults(
        dataSource.manager,
      );
      const orgDefaults = orgSettings.transformDefaults();
      const defaults = {
        ...courseDefaults,
        ...dropUndefined(orgDefaults),
      };
      const provider = providers[1];
      await CourseChatbotSettingsModel.update(
        {
          courseId: course1.id,
        },
        {
          organizationSettings: orgSettings,
          llmModel: provider.defaultModel,
          prompt: 'course-specific prompt',
          temperature: 0.5,
          topK: 3,
          similarityThresholdDocuments: 0.4,
          similarityThresholdQuestions: 0.3,
          usingDefaultModel: false,
          usingDefaultPrompt: false,
          usingDefaultTemperature: false,
          usingDefaultTopK: false,
          usingDefaultSimilarityThresholdDocuments: false,
          usingDefaultSimilarityThresholdQuestions: false,
        },
      );
      updateChatbotRepositorySpy.mockClear();

      const result = await service.resetCourseSetting(course0.id);
      expect(
        pick(result, [
          'llmId',
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ]),
      ).toEqual({
        ...defaults,
        usingDefaultModel: true,
        usingDefaultPrompt: true,
        usingDefaultTemperature: true,
        usingDefaultTopK: true,
        usingDefaultSimilarityThresholdDocuments: true,
        usingDefaultSimilarityThresholdQuestions: true,
      });

      expect(updateChatbotRepositorySpy).toHaveBeenCalledTimes(courses0.length);
      result.organizationSettings =
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization0.id },
          relations: {
            defaultProvider: {
              defaultModel: true,
              defaultVisionModel: true,
            },
          },
        });
      const chatbotDataSource = await chatbotDataSourceService.getDataSource();
      const chatbotSide = await chatbotDataSource.query(
        `
            SELECT * FROM course_settings_model WHERE "courseId" = $1;
        `,
        [course0.id],
      );
      expect(chatbotSide).toEqual([
        {
          courseId: course0.id,
          ...result.getMetadata(),
        },
      ]);
    });
  });

  describe('getCourseSettingsDefaults', () => {
    it("should fail if course setting does not exist and org settings wasn't passed in", async () => {
      await expect(
        service.getCourseSettingDefaults(course1.id),
      ).rejects.toThrow(
        new NotFoundException(
          ERROR_MESSAGES.chatbotService.courseSettingsNotFound,
        ),
      );
    });

    it.each([false, true])(
      'should the course default params mixed with org defaults if defined (pass org settings in %o)',
      async (passSetting: boolean) => {
        const courseDefaults = CourseChatbotSettingsModel.getDefaults(
          dataSource.manager,
        );
        const orgDefaults = orgSettings.transformDefaults();
        const results = await service.getCourseSettingDefaults(
          course0.id,
          passSetting ? orgSettings : undefined,
        );

        expect(results).toEqual({
          ...courseDefaults,
          ...dropUndefined(orgDefaults),
        });
      },
    );
  });

  const ollamaModels = {
    models: [
      {
        name: 'qwen2.5vl',
        model: 'qwen2.5vl',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          family: 'qwen25vl',
          families: ['qwen25vl'],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'gemma3',
        model: 'gemma3',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          family: 'gemma',
          families: ['gemma'],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'qwen2.5',
        model: 'qwen2.5',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          families: ['qwen'],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'qwen3',
        model: 'qwen3',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          families: ['qwen'],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'deepseek-r1',
        model: 'deepseek-r1',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          families: ['qwen'],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'nomic-embed-text',
        model: 'nomic-embed-text',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          families: [],
          parameter_size: '',
          quantization_level: '',
        },
      },
      {
        name: 'mxbai-embed-large',
        model: 'mxbai-embed-large',
        modifiedAt: new Date(),
        size: 0,
        details: {
          parent_model: '',
          format: '',
          families: [],
          parameter_size: '',
          quantization_level: '',
        },
      },
    ],
  };

  const visions = ['gemma3', 'qwen2.5vl'];
  const thinking = ['qwen3', 'deepseek-r1'];
  const embedding = ['nomic-embed-text', 'mxbai-embed-large'];

  const mockOllamaFetch = async (url: string) => {
    const res = (() => {
      switch (url) {
        case 'https://ollama.com/search?c=vision':
          return `
              <a href="/library/qwen2.5vl"></a>
              <a href="/library/gemma3"></a>
            `;
        case 'https://ollama.com/search?c=thinking':
          return `
              <a href="/library/qwen3"></a>
              <a href="/library/deepseek-r1"></a>
            `;
        case 'https://ollama.com/search?c=embedding':
          return `
              <a href="/library/nomic-embed-text"></a>
              <a href="/library/mxbai-embed-large"></a>
            `;
        default:
          return ollamaModels;
      }
    })();
    return {
      ok: true,
      json: () => res,
      text: () => res,
    };
  };

  describe('getOllamaAvailableModels', () => {
    let ollamaModelsByTagSpy: jest.SpyInstance;

    beforeEach(() => {
      ollamaModelsByTagSpy = jest.spyOn(service, 'getKnownOllamaModelsByTag');
    });

    afterEach(() => {
      ollamaModelsByTagSpy.mockRestore();
    });

    it('should fail if fetch request to API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      ollamaModelsByTagSpy.mockImplementation(() => []);
      await expect(
        service.getOllamaAvailableModels('https://fake-url', {
          Authorization: 'Bearer fake-key',
        }),
      ).rejects.toThrow(
        new HttpException(`Failed to contact Ollama Server: Not Found`, 404),
      );
      mockFetch.mockRejectedValue({});
      await expect(
        service.getOllamaAvailableModels('https://fake-url', {
          Authorization: 'Bearer fake-key',
        }),
      ).rejects.toThrow(
        new HttpException(`Failed to contact Ollama Server`, 400),
      );
    });

    it('should return the available ollama models with tags for vision, thinking and cut those with embedding', async () => {
      mockFetch.mockImplementation(mockOllamaFetch);
      const models = await service.getOllamaAvailableModels(
        'https://fake-url',
        { Authorization: 'Bearer fake-key' },
      );
      expect(ollamaModelsByTagSpy).toHaveBeenCalledTimes(3);
      expect(ollamaModelsByTagSpy).toHaveBeenNthCalledWith(1, 'vision');
      expect(ollamaModelsByTagSpy).toHaveBeenNthCalledWith(2, 'thinking');
      expect(ollamaModelsByTagSpy).toHaveBeenNthCalledWith(3, 'embedding');

      expect(models).toEqual(
        ollamaModels.models
          .filter((m) => !m.model.includes('embed'))
          .map((model, id) => {
            const isVision = visions.includes(model.model);
            const isThinking = thinking.includes(model.model);
            return {
              id,
              modelName: model.model,
              families: model.details.families,
              parameterSize: model.details.parameter_size,
              isRecommended: false,
              isText: true,
              isVision,
              isThinking,
              provider: null,
            };
          }),
      );
    });
  });

  describe('getOpenAIAvailableModels', () => {
    it('should fail if fetch request to API fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Not Authorized',
      });
      await expect(
        service.getOpenAIAvailableModels('abcdefghijklmnop', {}),
      ).rejects.toThrow(
        new HttpException(`Failed to contact OpenAI API: Not Authorized`, 401),
      );
      mockFetch.mockRejectedValue({});
      await expect(
        service.getOpenAIAvailableModels('abcdefghijklmnop', {}),
      ).rejects.toThrow(
        new BadRequestException('Failed to contact OpenAI API'),
      );
    });

    it('should return the available openai models', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => ({}) });
      const result = await service.getOpenAIAvailableModels(
        'abcdefghijklmnop',
        {},
      );
      expect(result).toEqual(openAIModels.map((v, i) => ({ id: i, ...v })));
    });
  });

  describe('getKnownOllamaModelsByTags', () => {
    it.each(['vision', 'thinking', 'embedding'])(
      'should fail if fetch request to API fails (tag = %s)',
      async (tag: 'vision' | 'thinking' | 'embedding') => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });
        await expect(service.getKnownOllamaModelsByTag(tag)).rejects.toThrow(
          new HttpException(`Failed to contact Ollama Library: Not Found`, 401),
        );
        mockFetch.mockRejectedValue({});
        await expect(service.getKnownOllamaModelsByTag(tag)).rejects.toThrow(
          new BadRequestException('Failed to contact Ollama Library'),
        );
      },
    );

    it.each(['vision', 'thinking', 'embedding'])(
      'should return the retrieved models based on tags (tag = %s)',
      async (tag: 'vision' | 'thinking' | 'embedding') => {
        mockFetch.mockImplementation(mockOllamaFetch);
        const result = await service.getKnownOllamaModelsByTag(tag);
        expect(result).toEqual(
          ollamaModels.models
            .map((v) => v.model)
            .filter((v) =>
              tag == 'vision'
                ? visions.includes(v)
                : tag == 'thinking'
                  ? thinking.includes(v)
                  : embedding.includes(v),
            ),
        );
      },
    );
  });
});
