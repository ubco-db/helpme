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
  CourseChatbotSettingsForm,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  CreateOrganizationChatbotSettingsBody,
  dropUndefined,
  ERROR_MESSAGES,
  OllamaLLMType,
  OllamaModelDescription,
  OrganizationChatbotSettingsDefaults,
  UpdateChatbotProviderBody,
  UpdateLLMTypeBody,
  UpsertCourseChatbotSettings,
} from '@koh/common';
import { ChatbotProviderModel } from './chatbot-infrastructure-models/chatbot-provider.entity';
import { LLMTypeModel } from './chatbot-infrastructure-models/llm-type.entity';
import { cloneDeep, pick } from 'lodash';
import { DataSource, DeepPartial, EntityManager, In } from 'typeorm';
import { CourseChatbotSettingsModel } from './chatbot-infrastructure-models/course-chatbot-settings.entity';
import { JSDOM } from 'jsdom';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ChatbotService {
  // Could rename 'documents' to 'resources' for more accurate wording when its not only PDFs
  // filePath currently relative

  constructor(
    private dataSource: DataSource,
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
          organizationId: course.organizationCourse.organizationId,
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
      const orgChatbotSettings = await orgChatbotSettingsRepo
        .create({
          organizationId,
          ...params,
        } as DeepPartial<OrganizationChatbotSettingsModel>)
        .save();

      orgChatbotSettings.providers = await Promise.all(
        providers.map(async (prov) =>
          this.createChatbotProvider(orgChatbotSettings, prov, em),
        ),
      );

      let defaultProvider: ChatbotProviderModel;
      if (providerIndex != undefined) {
        defaultProvider = orgChatbotSettings.providers[providerIndex];
      }
      defaultProvider ??= orgChatbotSettings.providers[0];
      orgChatbotSettings.defaultProvider = defaultProvider;

      inserted = await em.save(orgChatbotSettings);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.backfillCourseSettings(inserted);
    return inserted;
  }

  private async backfillCourseSettings(
    orgChatbotSettings: OrganizationChatbotSettingsModel,
  ) {
    const hasNoCourseSetting = await CourseModel.find({
      where: {
        chatbotSettings: undefined,
      },
    });

    const defaults = orgChatbotSettings.transformDefaults();
    for (const course of hasNoCourseSetting) {
      await CourseChatbotSettingsModel.create({
        courseId: course.id,
        organizationSettingsId: orgChatbotSettings.id,
        llmId: orgChatbotSettings.defaultProvider.defaultModelId,
        ...defaults,
      }).save();
    }
  }
  async createChatbotProvider(
    organizationChatbotSettings: OrganizationChatbotSettingsModel,
    params: CreateChatbotProviderBody,
    entityManager?: EntityManager,
  ): Promise<ChatbotProviderModel> {
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

    const provider = await (
      entityManager
        ? entityManager.getRepository(ChatbotProviderModel)
        : ChatbotProviderModel.getRepository()
    )
      .create({
        organizationChatbotSettings,
        ...params,
      })
      .save();

    models = models.map((model) => ({ ...model, providerId: provider.id }));
    const llms = await Promise.all(
      models.map(
        async (model) => await this.createLLMType(model, entityManager),
      ),
    );

    const defaultModel = llms.find(
      (llm) => llm.modelName == params.defaultModelName,
    );
    const defaultVisionModel = llms.find(
      (llm) => llm.modelName == params.defaultVisionModelName,
    );

    provider.defaultModelId = defaultModel.id;
    provider.defaultVisionModelId = defaultVisionModel.id;

    return entityManager
      ? await entityManager.save(provider)
      : await provider.save();
  }

  async createLLMType(
    params: CreateLLMTypeBody,
    entityManager?: EntityManager,
  ): Promise<LLMTypeModel> {
    return await (
      entityManager
        ? entityManager.getRepository(LLMTypeModel)
        : LLMTypeModel.getRepository()
    )
      .create({ ...params })
      .save();
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
        : organization.defaultProviderId;

    await OrganizationChatbotSettingsModel.update(
      {
        organizationId: organization.organizationId,
      },
      {
        ...originalAttrs,
        ...dropUndefined(params),
        defaultProviderId,
      } as DeepPartial<OrganizationChatbotSettingsModel>,
    );

    await organization.reload();
    return organization;
  }

  async updateChatbotProvider(
    provider: ChatbotProviderModel,
    params: UpdateChatbotProviderBody,
  ): Promise<ChatbotProviderModel> {
    const originalAttrs = pick(provider, [
      'providerType',
      'nickname',
      'headers',
      'baseUrl',
      'defaultModelId',
      'defaultVisionModelId',
    ]);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const em = queryRunner.manager;
      if (params.deletedModels) {
        for (const removed of params.deletedModels) {
          await this.deleteLLMType(removed, em);
        }
      }

      if (params.addedModels) {
        for (const added of params.addedModels) {
          await this.createLLMType({ ...added, providerId: provider.id }, em);
        }
      }

      const models = await em.find(LLMTypeModel, {
        where: { providerId: provider.id },
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

      await em.update(
        ChatbotProviderModel,
        {
          id: provider.id,
        },
        {
          ...originalAttrs,
          ...dropUndefined(params),
          defaultModelId: defaultModel.id,
          defaultVisionModelId: defaultVisionModel.id,
        },
      );

      await queryRunner.commitTransaction();

      return await em.findOne(ChatbotProviderModel, {
        where: { id: provider.id },
        relations: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateLLMType(
    llmType: LLMTypeModel,
    params: UpdateLLMTypeBody,
    entityManager?: EntityManager,
  ): Promise<LLMTypeModel> {
    const originalAttrs = pick(llmType, [
      'modelName',
      'isText',
      'isThinking',
      'isVision',
    ]);
    await (entityManager ? entityManager : this.dataSource.manager).update(
      LLMTypeModel,
      {
        id: llmType.id,
      },
      {
        ...originalAttrs,
        ...dropUndefined(params),
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
          ...dropUndefined(params),
        },
      );
      await match.reload();
      return match;
    } else {
      const defaults = organizationSettings.transformDefaults();
      return await CourseChatbotSettingsModel.save({
        courseId,
        organizationSettingsId: organizationSettings.id,
        ...defaults,
        ...dropUndefined(params),
      });
    }
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

    const defaults = await this.getCourseSettingDefaults(
      courseId,
      courseSettings,
    );
    await CourseChatbotSettingsModel.update(
      {
        courseId,
      },
      {
        ...defaults,
      },
    );

    await courseSettings.reload();

    return courseSettings;
  }

  async getCourseSettingDefaults(
    courseId: number,
    courseSettings?: CourseChatbotSettingsModel,
  ): Promise<CourseChatbotSettingsForm> {
    if (!courseSettings) {
      courseSettings = await CourseChatbotSettingsModel.findOne({
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
    }

    const defaultParams =
      courseSettings.organizationSettings.transformDefaults();

    const columnMetadata =
      CourseChatbotSettingsModel.getRepository().manager.connection.getMetadata(
        CourseChatbotSettingsModel,
      );
    let defaults: Record<string, any> = {};
    columnMetadata.columns.forEach((col) => {
      defaults[col.propertyName] = col.default;
    });
    defaults = pick(defaults, [
      'prompt',
      'temperature',
      'similarityThresholdDocuments',
      'similarityThresholdQuestions',
    ]);

    return {
      ...defaults,
      ...dropUndefined(defaultParams),
      llmId: courseSettings.organizationSettings.defaultProvider.defaultModelId,
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
          isText: !isVision,
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
    }).then((res) => {
      if (!res.ok) {
        throw new HttpException(
          `Failed to contact Ollama Library: ${res.statusText}`,
          res.status,
        );
      }
      return res.text();
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
