import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InteractionModel } from './interaction.entity';
import { ChatbotQuestionModel } from './question.entity';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';
import { OrganizationChatbotSettingsModel } from './chatbot-infrastructure-models/organization-chatbot-settings.entity';
import {
  ChatbotAllowedHeaders,
  ChatbotSettings,
  ChatbotSettingsMetadata,
  CourseChatbotSettingsForm,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  dropUndefined,
  ERROR_MESSAGES,
  OllamaLLMType,
  OllamaModelDescription,
  OpenAILLMType,
  OrganizationChatbotSettingsDefaults,
  UpdateChatbotProviderBody,
  UpdateLLMTypeBody,
  UpsertCourseChatbotSettings,
} from '@koh/common';
import { ChatbotProviderModel } from './chatbot-infrastructure-models/chatbot-provider.entity';
import { LLMTypeModel } from './chatbot-infrastructure-models/llm-type.entity';
import { cloneDeep, pick } from 'lodash';
import { DataSource, DeepPartial, EntityManager, In, IsNull } from 'typeorm';
import { CourseChatbotSettingsModel } from './chatbot-infrastructure-models/course-chatbot-settings.entity';
import { JSDOM } from 'jsdom';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ChatbotApiService } from './chatbot-api.service';
import { ChatbotDataSourceService } from './chatbot-datasource/chatbot-datasource.service';

// OpenAI makes it really annoying to scrape any data related
// to the model capabilities (text, image processing) (selfish, much?)
// So instead, we fetch just to check on the API key and otherwise
// we just use a pre-coded constant

export const openAIModels: OpenAILLMType[] = [
  {
    id: 0,
    modelName: 'gpt-4.1',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4.1'],
  },
  {
    id: 0,
    modelName: 'gpt-4.1-mini',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4.1'],
  },
  {
    id: 0,
    modelName: 'gpt-4.1-nano',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4.1'],
  },
  {
    id: 0,
    modelName: 'gpt-4o',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4o'],
  },
  {
    id: 0,
    modelName: 'gpt-4o-mini',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4o'],
  },
  {
    id: 0,
    modelName: 'gpt-4',
    isRecommended: false,
    isText: true,
    isVision: false,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4'],
  },
  {
    id: 0,
    modelName: 'gpt-4-turbo',
    isRecommended: false,
    isText: true,
    isVision: true,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-4'],
  },
  {
    id: 0,
    modelName: 'gpt-3.5-turbo',
    isRecommended: false,
    isText: true,
    isVision: false,
    isThinking: false,
    provider: undefined as any,
    families: ['gpt-3.5'],
  },
];

@Injectable()
export class ChatbotService {
  // Could rename 'documents' to 'resources' for more accurate wording when its not only PDFs
  // filePath currently relative

  constructor(
    private dataSource: DataSource,
    private chatbotDataSource: ChatbotDataSourceService,
    private chatbotApiService: ChatbotApiService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createInteraction(
    courseId: number,
    userId: number,
  ): Promise<InteractionModel> {
    const course = await CourseModel.findOne({
      where: {
        id: courseId,
      },
    });
    const user = await UserModel.findOne({
      where: {
        id: userId,
      },
    });

    if (!course) {
      throw new HttpException(
        'Course not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!user) {
      throw new HttpException(
        'User not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    const interaction = InteractionModel.create({
      course,
      user,
      timestamp: new Date(),
    });

    return await interaction.save();
  }

  async createQuestion(data: {
    questionText: string;
    responseText: string;
    vectorStoreId: string;
    suggested: boolean;
    isPreviousQuestion: boolean;
    interactionId: number;
  }): Promise<ChatbotQuestionModel> {
    if (!data.questionText || !data.responseText || !data.vectorStoreId) {
      const missingFields = [];
      if (!data.questionText) missingFields.push('questionText');
      if (!data.responseText) missingFields.push('responseText');
      if (!data.vectorStoreId) missingFields.push('vectorStoreId');

      throw new HttpException(
        `Missing required question properties: ${missingFields.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const interaction = await InteractionModel.findOne({
      where: {
        id: data.interactionId,
      },
    });
    if (!interaction) {
      throw new HttpException(
        'Interaction not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    const question = ChatbotQuestionModel.create({
      interaction,
      questionText: data.questionText,
      responseText: data.responseText,
      suggested: data.suggested,
      timestamp: new Date(),
      vectorStoreId: data.vectorStoreId,
      isPreviousQuestion: data.isPreviousQuestion,
    });

    await question.save();

    return question;
  }

  // Unused, but going to leave here since it's not unlikely it will be used again in the future
  async editQuestion(data: any): Promise<ChatbotQuestionModel> {
    const question = await ChatbotQuestionModel.findOne({
      where: {
        id: data.id,
      },
    });
    if (!question) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    Object.assign(question, data);
    if (data.interactionId) {
      const tempInteraction = await InteractionModel.findOne({
        where: {
          id: data.interactionId,
        },
      });
      if (!tempInteraction) {
        throw new HttpException(
          'Interaction not found based on the provided ID.',
          HttpStatus.NOT_FOUND,
        );
      }
      question.interaction = tempInteraction;
    }
    await question.save();
    return question;
  }

  async deleteQuestion(questionId: number) {
    const chatQuestion = await ChatbotQuestionModel.findOne({
      where: {
        id: questionId,
      },
    });

    if (!chatQuestion) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }

    return await chatQuestion.remove();
  }

  async getInteractionsAndQuestions(
    courseId: number,
  ): Promise<InteractionModel[]> {
    const course = await CourseModel.findOne({
      // i hate how i have to do this (for some reason I can't just query interactions with courseId because the join relation wasn't really set up correctly in the InteractionModel entity)
      where: {
        id: courseId,
      },
    });
    return await InteractionModel.find({
      where: { course: course },
      relations: {
        questions: true,
      },
    });
  }

  async getAllInteractionsForUser(userId: number): Promise<InteractionModel[]> {
    return await InteractionModel.find({
      where: { user: { id: userId } },
      relations: {
        questions: true,
      },
    });
  }

  async updateQuestionUserScore(questionId: number, userScore: number) {
    const question = await ChatbotQuestionModel.findOne({
      where: {
        id: questionId,
      },
    });
    if (!question) {
      throw new HttpException(
        'Question not found based on the provided ID.',
        HttpStatus.NOT_FOUND,
      );
    }
    question.userScore = userScore;
    await question.save();
    return question;
  }

  async isChatbotServiceLegacy(courseId: number): Promise<boolean> {
    const course = await CourseModel.findOne({
      where: { id: courseId },
      relations: { organizationCourse: true },
    });

    return (
      (await OrganizationChatbotSettingsModel.findOne({
        where: {
          organizationId: course.organizationCourse?.organizationId,
        },
      })) == undefined
    );
  }

  async createOrganizationSettings(
    organizationId: number,
    params: CreateOrganizationChatbotSettingsBody,
  ): Promise<OrganizationChatbotSettingsModel> {
    const providers = cloneDeep(params.providers);
    if (!providers || providers.length == 0) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotService.providersRequired,
      );
    }
    delete params.providers;
    const providerIndex = params.defaultProvider;
    delete params.defaultProvider;

    let inserted: OrganizationChatbotSettingsModel;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const em = queryRunner.manager;
      const orgChatbotSettingsRepo = em.getRepository(
        OrganizationChatbotSettingsModel,
      );
      const orgChatbotSettings = await orgChatbotSettingsRepo.save({
        organizationId,
        ...params,
      } as DeepPartial<OrganizationChatbotSettingsModel>);

      for (const prov of providers) {
        await this.createChatbotProvider(orgChatbotSettings, prov, em);
      }

      inserted = await orgChatbotSettingsRepo.save(orgChatbotSettings);
      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive && !queryRunner.isReleased) {
        await queryRunner.rollbackTransaction();
      }
      if (inserted) {
        // Just in case the transaction wasn't fully rolled back
        await queryRunner.manager.delete(OrganizationChatbotSettingsModel, {
          id: inserted.id,
        });
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (inserted) {
      const newProviders = await ChatbotProviderModel.find({
        where: {
          orgChatbotSettingsId: inserted.id,
        },
      });

      let defaultProvider: ChatbotProviderModel;
      if (providerIndex != undefined) {
        defaultProvider = newProviders[providerIndex];
      }
      defaultProvider ??= newProviders[0];

      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        if (!defaultProvider) {
          throw new BadRequestException(
            ERROR_MESSAGES.chatbotService.defaultModelNotFound,
          );
        }
        await qr.manager
          .getRepository(OrganizationChatbotSettingsModel)
          .update(
            { id: inserted.id },
            { defaultProviderId: defaultProvider.id },
          );

        await qr.commitTransaction();
      } catch (err) {
        if (qr.isTransactionActive) {
          await qr.rollbackTransaction();
        }
        await qr.manager.delete(OrganizationChatbotSettingsModel, {
          id: inserted.id,
        });
        throw err;
      } finally {
        await qr.release();
      }
    }

    inserted = await OrganizationChatbotSettingsModel.findOne({
      where: { id: inserted.id },
      relations: {
        providers: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
        defaultProvider: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
      },
    });
    await this.backfillCourseSettings(inserted);
    return inserted;
  }

  private async backfillCourseSettings(
    orgChatbotSettings: OrganizationChatbotSettingsModel,
  ) {
    const hasNoCourseSetting = await CourseModel.find({
      where: {
        organizationCourse: {
          organizationId: orgChatbotSettings.organizationId,
        },
        chatbotSettings: IsNull(),
      },
    });

    for (const course of hasNoCourseSetting) {
      let existingSetting: ChatbotSettings;
      try {
        existingSetting = await this.chatbotApiService.getChatbotSettings(
          course.id,
          '',
        );
      } catch (err) {
        try {
          const dataSource = await this.chatbotDataSource.getDataSource();
          const qry = dataSource.createQueryRunner();
          await qry.connect();
          existingSetting = (
            await qry.query(
              'SELECT * FROM course_setting WHERE "pageContent" = $1',
              [String(course.id)],
            )
          )[0];
        } catch (_err) {}
      }
      if (!existingSetting) {
        console.error(
          `Failed to load existing chatbot settings for course ${course.id}`,
        );
      }

      const originals = dropUndefined(
        pick((existingSetting?.metadata ?? {}) as ChatbotSettingsMetadata, [
          'prompt',
          'temperature',
          'topK',
          'similarityThresholdDocuments',
          'similarityThresholdQuestions',
        ]),
        true,
      );

      const { defaults, usingDefaults } =
        await this.getUsingCourseDefaultsParams(orgChatbotSettings, originals);

      let matchingModel: LLMTypeModel;
      if (
        existingSetting?.metadata?.modelName != undefined ||
        existingSetting?.metadata?.model?.modelName != undefined
      ) {
        for (const provider of orgChatbotSettings.providers) {
          console.log(
            existingSetting.metadata.modelName,
            existingSetting.metadata.model?.modelName,
          );
          matchingModel = provider.availableModels.find(
            (m) =>
              (m.modelName == existingSetting.metadata.modelName ||
                m.modelName == existingSetting.metadata.model?.modelName) &&
              m.isText,
          );
          if (matchingModel) {
            if (
              matchingModel.id !=
              orgChatbotSettings.defaultProvider.defaultModelId
            ) {
              usingDefaults['usingDefaultModel'] = false;
            }
            break;
          }
        }
      }

      await CourseChatbotSettingsModel.create({
        courseId: course.id,
        organizationSettingsId: orgChatbotSettings.id,
        ...defaults,
        ...originals,
        ...usingDefaults,
        llmId: matchingModel
          ? matchingModel.id
          : orgChatbotSettings.defaultProvider.defaultModelId,
      }).save();
    }
  }

  async createChatbotProvider(
    organizationChatbotSettings: OrganizationChatbotSettingsModel,
    params: CreateChatbotProviderBody,
    entityManager?: EntityManager,
  ): Promise<ChatbotProviderModel> {
    const queryRunner = !entityManager
      ? this.dataSource.createQueryRunner()
      : undefined;
    if (queryRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }
    let provider: ChatbotProviderModel;
    try {
      const em = entityManager ?? queryRunner.manager;
      let models = cloneDeep(params.models);
      delete params.models;

      if (
        !models.some((m) => m.modelName == params.defaultModelName) ||
        !models.some((m) => m.modelName == params.defaultVisionModelName)
      ) {
        throw new BadRequestException(
          ERROR_MESSAGES.chatbotService.defaultModelNotFound,
        );
      }

      provider = await em.getRepository(ChatbotProviderModel).save({
        organizationChatbotSettings,
        ...params,
      });

      models = models.map((model) => ({
        ...model,
        providerId: provider.id,
        additionalNotes: model.additionalNotes ?? [],
      }));
      // Don't do Promise.all as it has weird behaviour in transactions
      const llms: LLMTypeModel[] = [];
      for (const model of models) {
        llms.push(await this.createLLMType(model, em));
      }

      const defaultModel = llms.find(
        (llm) => llm.modelName == params.defaultModelName,
      );

      const defaultVisionModel = llms.find(
        (llm) => llm.modelName == params.defaultVisionModelName,
      );

      provider.defaultModelId = defaultModel.id;
      provider.defaultVisionModelId = defaultVisionModel.id;

      provider = await em.getRepository(ChatbotProviderModel).save(provider);

      if (queryRunner) {
        await queryRunner.commitTransaction();
      }
    } catch (err) {
      if (queryRunner) {
        if (queryRunner.isTransactionActive && !queryRunner.isReleased) {
          await queryRunner.rollbackTransaction();
        }
      }
      if (provider) {
        // Just in case it wasn't fully rolled back
        await queryRunner.manager.delete(ChatbotProviderModel, {
          id: provider.id,
        });
      }
      throw err;
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
    }

    return await ChatbotProviderModel.findOne({
      where: { id: provider.id },
      relations: {
        defaultModel: true,
        defaultVisionModel: true,
        availableModels: true,
      },
    });
  }

  async createLLMType(
    params: CreateLLMTypeBody,
    entityManager?: EntityManager,
  ): Promise<LLMTypeModel> {
    delete (params as any).provider;
    return await (
      entityManager
        ? entityManager.getRepository(LLMTypeModel)
        : LLMTypeModel.getRepository()
    ).save({
      ...params,
      additionalNotes: params.additionalNotes ?? [],
    });
  }

  async updateOrganizationSettings(
    organization: OrganizationChatbotSettingsModel,
    params?: OrganizationChatbotSettingsDefaults,
  ): Promise<OrganizationChatbotSettingsModel> {
    const defaultProvider = params.defaultProvider;
    delete params.defaultProvider;
    const originalAttrs = pick(organization, [
      'default_prompt',
      'default_temperature',
      'default_topK',
      'default_similarityThresholdQuestions',
      'default_similarityThresholdDocuments',
    ]);

    const defaultProviderId =
      defaultProvider != undefined &&
      defaultProvider != organization.defaultProviderId &&
      organization.providers.some((p) => p.id == defaultProvider)
        ? defaultProvider
        : (organization.defaultProviderId ?? organization.providers[0]?.id);

    await OrganizationChatbotSettingsModel.update(
      {
        organizationId: organization.organizationId,
      },
      {
        id: organization.id, // Effectively does nothing as it's only for subscriber callbacks
        ...originalAttrs,
        ...dropUndefined(params),
        defaultProviderId,
      } as DeepPartial<OrganizationChatbotSettingsModel>,
    );

    return await OrganizationChatbotSettingsModel.findOne({
      where: { organizationId: organization.organizationId },
      relations: {
        providers: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
        defaultProvider: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
        courseSettingsInstances: true,
      },
    });
  }

  async updateChatbotProvider(
    provider: ChatbotProviderModel,
    params: UpdateChatbotProviderBody,
  ): Promise<ChatbotProviderModel> {
    const providerId = provider.id;
    const originalAttrs = pick(provider, [
      'providerType',
      'nickname',
      'headers',
      'baseUrl',
      'apiKey',
      'defaultModelId',
      'defaultVisionModelId',
      'additionalNotes',
    ]);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const em = queryRunner.manager;

      // Add models first in case one of them is selected as the default model
      if (params.addedModels) {
        for (const added of params.addedModels) {
          await this.createLLMType(
            {
              ...added,
              providerId: providerId,
              additionalNotes: added.additionalNotes ?? [],
            },
            em,
          );
        }
      }

      const models = await em.find(LLMTypeModel, {
        where: { providerId: providerId },
      });

      const defaultModel = params.defaultModelName
        ? models.find((m) => m.modelName == params.defaultModelName)
        : undefined;

      if (defaultModel) {
        params = {
          ...params,
          defaultModelId: defaultModel.id,
        };
      }

      const defaultVisionModel = params.defaultVisionModelName
        ? models.find((m) => m.modelName == params.defaultVisionModelName)
        : undefined;

      if (defaultVisionModel) {
        params = {
          ...params,
          defaultVisionModelId: defaultVisionModel.id,
        };
      }

      if (params.modifiedModels) {
        params.modifiedModels = params.modifiedModels.filter(
          (m0) => !params.deletedModels?.some((m1) => m1 == m0.modelId),
        );
        for (const modified of params.modifiedModels) {
          const modelIndex = models.findIndex((m) => m.id == modified.modelId);
          if (modelIndex < 0) {
            throw new NotFoundException(
              ERROR_MESSAGES.chatbotService.modelNotFound,
            );
          }
          const model = models[modelIndex];
          if (
            modified.isText != undefined &&
            !modified.isText &&
            (params.defaultModelId == modified.modelId ||
              (params.defaultModelId == undefined &&
                provider.defaultModelId == modified.modelId))
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.chatbotService.cannotChangeDefaultModelType(
                'text',
              ),
            );
          }

          if (
            modified.isVision != undefined &&
            !modified.isVision &&
            (params.defaultVisionModelId == modified.modelId ||
              (params.defaultVisionModelId == undefined &&
                provider.defaultVisionModelId == modified.modelId))
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.chatbotService.cannotChangeDefaultModelType(
                'text',
              ),
            );
          }

          const updated = await this.updateLLMType(
            model,
            {
              ...modified,
              additionalNotes: modified.additionalNotes ?? [],
            },
            em,
          );
          models[modelIndex] = updated;
        }
      }

      await em.update(
        ChatbotProviderModel,
        {
          id: providerId,
        },
        {
          id: providerId, // Effectively does nothing as it's only for subscriber callbacks
          ...originalAttrs,
          ...dropUndefined(
            pick(params, [
              'providerType',
              'nickname',
              'headers',
              'baseUrl',
              'apiKey',
              'defaultModelId',
              'defaultVisionModelId',
              'additionalNotes',
            ]),
          ),
        },
      );

      // Delete models after, will throw exception if attempting to delete the original model but other updates
      // will propagate
      if (params.deletedModels) {
        for (const removed of params.deletedModels) {
          await this.deleteLLMType(removed, em);
        }
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return await ChatbotProviderModel.findOne({
      where: { id: provider.id },
      relations: {
        defaultModel: true,
        defaultVisionModel: true,
        availableModels: true,
      },
    });
  }

  async updateLLMType(
    llmType: LLMTypeModel,
    params: UpdateLLMTypeBody,
    entityManager?: EntityManager,
  ): Promise<LLMTypeModel> {
    const originalAttrs = pick(llmType, [
      'modelName',
      'isRecommended',
      'isText',
      'isThinking',
      'isVision',
      'additionalNotes',
    ]);
    await (entityManager ? entityManager : this.dataSource.manager).update(
      LLMTypeModel,
      {
        id: llmType.id,
      },
      {
        id: llmType.id, // Effectively does nothing as it's only for subscriber callbacks
        providerId: llmType.providerId,
        ...originalAttrs,
        ...dropUndefined(
          pick(params, [
            'modelName',
            'isRecommended',
            'isText',
            'isThinking',
            'isVision',
            'additionalNotes',
          ]),
        ),
      },
    );
    if (!entityManager) {
      await llmType.reload();
    } else {
      llmType = await entityManager.findOne(LLMTypeModel, {
        where: { id: llmType.id },
        relations: { provider: true },
      });
    }
    return llmType;
  }

  async deleteOrganizationSettings(organizationId: number) {
    await OrganizationChatbotSettingsModel.delete({
      organizationId,
    });
  }

  async deleteChatbotProvider(
    providerId: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    const providerModelRepository = entityManager
      ? entityManager.getRepository(ChatbotProviderModel)
      : ChatbotProviderModel.getRepository();
    const orgSettingsRepository = entityManager
      ? entityManager.getRepository(OrganizationChatbotSettingsModel)
      : OrganizationChatbotSettingsModel.getRepository();
    const courseSettingsRepository = entityManager
      ? entityManager.getRepository(CourseChatbotSettingsModel)
      : CourseChatbotSettingsModel.getRepository();

    const provider = await providerModelRepository.findOne({
      where: {
        id: providerId,
      },
      relations: {
        availableModels: true,
      },
    });
    const organizationSettings = await orgSettingsRepository.findOne({
      where: {
        id: provider.orgChatbotSettingsId,
      },
      relations: {
        providers: true,
      },
    });
    if (
      organizationSettings.providers.length <= 1 ||
      organizationSettings.defaultProviderId == providerId
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotService.cannotDeleteDefaultProvider,
      );
    }

    const defaultProvider = await providerModelRepository.findOne({
      where: {
        id: organizationSettings.defaultProviderId,
      },
    });

    // Update any affected courses
    await courseSettingsRepository.update(
      {
        llmId: In(provider.availableModels.map((m) => m.id)),
      },
      {
        llmId: defaultProvider.defaultModelId,
        usingDefaultModel: true,
      },
    );

    await providerModelRepository.delete({ id: providerId });
  }

  async deleteLLMType(
    llmTypeId: number,
    entityManager?: EntityManager,
  ): Promise<void> {
    const repository = entityManager
      ? entityManager.getRepository(LLMTypeModel)
      : LLMTypeModel.getRepository();
    const providerRepository = entityManager
      ? entityManager.getRepository(ChatbotProviderModel)
      : ChatbotProviderModel.getRepository();
    const courseSettingsRepository = entityManager
      ? entityManager.getRepository(CourseChatbotSettingsModel)
      : CourseChatbotSettingsModel.getRepository();

    const llmType = await repository.findOne({ where: { id: llmTypeId } });
    if (!llmType) return;

    const provider = await providerRepository.findOne({
      where: {
        id: llmType.providerId,
      },
    });
    if (
      provider.defaultModelId == llmTypeId ||
      provider.defaultVisionModelId == llmTypeId
    ) {
      throw new BadRequestException(
        ERROR_MESSAGES.chatbotService.cannotDeleteDefaultModel,
      );
    }

    // Update any effected courses

    await courseSettingsRepository.update(
      {
        llmId: llmTypeId,
      },
      {
        llmId: provider.defaultModelId,
      },
    );

    await repository.delete({ id: llmTypeId });
  }

  async upsertCourseSetting(
    organizationSettings: OrganizationChatbotSettingsModel,
    courseId: number,
    params: UpsertCourseChatbotSettings,
  ): Promise<CourseChatbotSettingsModel> {
    const match = await CourseChatbotSettingsModel.findOne({
      where: { courseId },
    });
    const { defaults, usingDefaults } = await this.getUsingCourseDefaultsParams(
      organizationSettings,
      params,
    );
    if (match) {
      await CourseChatbotSettingsModel.update(
        {
          courseId,
        },
        {
          ...pick(match, [
            'llmId',
            'prompt',
            'temperature',
            'similarityThresholdDocuments',
            'similarityThresholdQuestions',
          ]),
          ...defaults,
          ...dropUndefined(params),
          ...usingDefaults,
        },
      );
    } else {
      await CourseChatbotSettingsModel.save({
        courseId,
        organizationSettingsId: organizationSettings.id,
        ...defaults,
        ...dropUndefined(params),
        ...usingDefaults,
      });
    }
    return await CourseChatbotSettingsModel.findOne({
      where: { courseId },
      relations: {
        organizationSettings: true,
        course: true,
        llmModel: {
          provider: {
            defaultModel: true,
            defaultVisionModel: true,
          },
        },
      },
    });
  }

  async resetCourseSetting(
    courseId: number,
  ): Promise<CourseChatbotSettingsModel> {
    const courseSettings = await CourseChatbotSettingsModel.findOne({
      where: { courseId },
      relations: {
        organizationSettings: {
          defaultProvider: true,
        },
      },
    });
    if (!courseSettings) {
      throw new NotFoundException(
        ERROR_MESSAGES.chatbotService.courseSettingsNotFound,
      );
    }

    const { defaults, usingDefaults } = await this.getUsingCourseDefaultsParams(
      courseSettings.organizationSettings,
    );

    await CourseChatbotSettingsModel.update(
      {
        courseId,
      },
      {
        ...defaults,
        ...usingDefaults,
      },
    );

    return await CourseChatbotSettingsModel.findOne({
      where: { courseId },
      relations: {
        course: true,
        llmModel: {
          provider: {
            defaultModel: true,
            defaultVisionModel: true,
          },
        },
      },
    });
  }

  private async getUsingCourseDefaultsParams(
    organizationSettings: OrganizationChatbotSettingsModel,
    params: any = {},
  ): Promise<{
    defaults: Record<string, any>;
    usingDefaults: Record<string, boolean>;
  }> {
    if (!organizationSettings.defaultProvider) {
      organizationSettings.defaultProvider = await ChatbotProviderModel.findOne(
        {
          where: { id: organizationSettings.defaultProviderId },
        },
      );
    }

    const usingDefaultsKeys = CourseChatbotSettingsModel.getUsingDefaultsKeys();
    const defaults = await this.getCourseSettingDefaults(
      -1,
      organizationSettings,
    );
    const dropped = dropUndefined(params, true);

    // Match where parameters were set (not using defaults)
    const matchKeys = Object.keys(dropped).filter((k0) =>
      usingDefaultsKeys.some(
        (k1) =>
          (k0 == 'llmId'
            ? k1 == 'usingDefaultModel'
            : k1.toLowerCase().includes(k0.toLowerCase())) &&
          dropped[k0] != defaults[k0],
      ),
    );

    const usingDefaults = CourseChatbotSettingsModel.getPopulatedUsingDefaults({
      usingDefaultModel:
        !!defaults['llmId'] && !matchKeys.some((k) => k == 'llmId'),
      usingDefaultPrompt:
        !!defaults['prompt'] && !matchKeys.some((k) => k == 'prompt'),
      usingDefaultTemperature:
        !!defaults['temperature'] && !matchKeys.some((k) => k == 'temperature'),
      usingDefaultTopK:
        !!defaults['topK'] && !matchKeys.some((k) => k == 'topK'),
      usingDefaultSimilarityThresholdDocuments:
        !!defaults['similarityThresholdDocuments'] &&
        !matchKeys.some((k) => k == 'similarityThresholdDocuments'),
      usingDefaultSimilarityThresholdQuestions:
        !!defaults['similarityThresholdQuestions'] &&
        !matchKeys.some((k) => k == 'similarityThresholdQuestions'),
    });

    return {
      defaults,
      usingDefaults,
    };
  }

  async getCourseSettingDefaults(
    courseId: number,
    organizationSettings?: OrganizationChatbotSettingsModel,
  ): Promise<CourseChatbotSettingsForm> {
    if (!organizationSettings) {
      const courseSettings = await CourseChatbotSettingsModel.findOne({
        where: { courseId },
        relations: {
          organizationSettings: {
            defaultProvider: true,
          },
        },
      });
      if (!courseSettings) {
        throw new NotFoundException(
          ERROR_MESSAGES.chatbotService.courseSettingsNotFound,
        );
      }
      organizationSettings = courseSettings.organizationSettings;
    }

    const defaultParams = organizationSettings.transformDefaults();
    let defaults = CourseChatbotSettingsModel.getDefaults();
    defaults = pick(defaults, [
      'llmId',
      'prompt',
      'temperature',
      'topK',
      'similarityThresholdDocuments',
      'similarityThresholdQuestions',
    ]);

    return {
      ...defaults,
      ...dropUndefined(defaultParams),
    };
  }

  async getOllamaAvailableModels(
    baseUrl: string,
    headers: ChatbotAllowedHeaders,
  ): Promise<OllamaLLMType[]> {
    const cached = await this.cacheManager.get<OllamaLLMType[]>(
      `ollama-models-${baseUrl}`,
    );
    if (cached != undefined) {
      return cached;
    }
    const visionModels = await this.getKnownOllamaModelsByTag('vision');
    const thinkingModels = await this.getKnownOllamaModelsByTag('thinking');
    const embeddingModels = await this.getKnownOllamaModelsByTag('embedding');

    if (!baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }

    const response: { models: OllamaModelDescription[] } = await fetch(
      `${baseUrl}/api/tags`,
      {
        method: 'GET',
        headers: {
          ...headers,
        },
      },
    )
      .then((res) => {
        if (!res.ok) {
          throw new HttpException(
            `Failed to contact Ollama Server: ${res.statusText}`,
            res.status,
          );
        }
        return res.json();
      })
      .catch((err) => {
        if (err instanceof HttpException) {
          throw err;
        } else {
          throw new BadRequestException('Failed to contact Ollama Server');
        }
      });

    const models = response.models
      .filter(
        (model) =>
          !embeddingModels.some((em) =>
            (model.model ?? model.name).startsWith(em),
          ),
      )
      .map((model, id) => {
        const isVision = visionModels.some((vm) =>
          (model.model ?? model.name).startsWith(vm),
        );
        const isThinking = thinkingModels.some((tm) =>
          (model.model ?? model.name).startsWith(tm),
        );

        return {
          id,
          modelName: model.model ?? model.name,
          families: model.details.families ?? [model.details.family],
          parameterSize: model.details.parameter_size,
          isRecommended: false,
          isText: true,
          isVision,
          isThinking,
          provider: null,
        };
      });

    // Live for 5 minutes
    await this.cacheManager.set(
      `ollama-models-${baseUrl}`,
      models,
      5 * 60 * 1000,
    );
    return models;
  }

  async getOpenAIAvailableModels(
    apiKey: string,
    headers: ChatbotAllowedHeaders,
  ): Promise<OpenAILLMType[]> {
    const cached =
      await this.cacheManager.get<OpenAILLMType[]>(`openai-models`);
    if (cached != undefined) {
      return cached;
    }

    await fetch(`https://api.openai.com/v1/models`, {
      method: 'GET',
      headers: {
        ...headers,
        Authorization: `Bearer ${apiKey}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new HttpException(
            `Failed to contact OpenAI API: ${res.statusText}`,
            res.status,
          );
        }
        return res.json();
      })
      .catch((err) => {
        if (err instanceof HttpException) {
          throw err;
        } else {
          throw new BadRequestException('Failed to contact OpenAI API');
        }
      });

    openAIModels.forEach((v, i) => {
      v.id = i;
    });

    await this.cacheManager.set(`openai-models`, openAIModels, 5 * 60 * 1000);
    return openAIModels;
  }

  async getKnownOllamaModelsByTag(
    tag: 'vision' | 'thinking' | 'embedding',
  ): Promise<string[]> {
    const url = `https://ollama.com/search?c=${tag}`;
    const cached = await this.cacheManager.get<string[]>(
      `ollama-models-${url}`,
    );
    if (cached != undefined) {
      return cached;
    }
    const response = await fetch(url, {
      method: 'GET',
    })
      .then((res) => {
        if (!res.ok) {
          throw new HttpException(
            `Failed to contact Ollama Library: ${res.statusText}`,
            res.status,
          );
        }
        return res.text();
      })
      .catch((err) => {
        if (err instanceof HttpException) {
          throw err;
        } else {
          throw new BadRequestException('Failed to contact Ollama Library');
        }
      });

    const { document } = new JSDOM(response).window;

    const visionModelNames: string[] = [];
    document.querySelectorAll('a').forEach((anchor) => {
      const libraryLink = anchor.href;
      const regexMatch = libraryLink.match(/\/library\/[a-zA-Z.0-9]*/);
      if (regexMatch != null && regexMatch.length > 0) {
        visionModelNames.push(libraryLink.substring('/library/'.length));
      }
    });
    // Let it live for one day since it's an external resource
    await this.cacheManager.set(
      `ollama-models-${url}`,
      visionModelNames,
      24 * 60 * 60 * 1000,
    );
    return visionModelNames;
  }
}
