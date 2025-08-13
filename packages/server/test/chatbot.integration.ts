import { ChatbotModule } from 'chatbot/chatbot.module';
import {
  ChatbotAskSuggestedParams,
  ChatbotServiceProvider,
  ChatbotServiceType,
  CreateChatbotProviderBody,
  CreateOrganizationChatbotSettingsBody,
  dropUndefined,
  ERROR_MESSAGES,
  OrganizationRole,
  Role,
  UpdateChatbotProviderBody,
} from '@koh/common';
import {
  ChatbotProviderFactory,
  ChatTokenFactory,
  CourseChatbotSettingsFactory,
  CourseFactory,
  InteractionFactory,
  LLMTypeFactory,
  OrganizationChatbotSettingsFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { ChatbotQuestionModel } from 'chatbot/question.entity';
import { OrganizationModel } from '../src/organization/organization.entity';
import { CourseModel } from '../src/course/course.entity';
import { OrganizationCourseModel } from '../src/organization/organization-course.entity';
import { pick } from 'lodash';
import { OrganizationChatbotSettingsModel } from '../src/chatbot/chatbot-infrastructure-models/organization-chatbot-settings.entity';
import { LLMTypeModel } from '../src/chatbot/chatbot-infrastructure-models/llm-type.entity';
import { ChatbotProviderModel } from '../src/chatbot/chatbot-infrastructure-models/chatbot-provider.entity';
import { ChatbotService } from '../src/chatbot/chatbot.service';
import { CourseChatbotSettingsModel } from '../src/chatbot/chatbot-infrastructure-models/course-chatbot-settings.entity';
import { UserModel } from '../src/profile/user.entity';
import { ChatbotApiService } from '../src/chatbot/chatbot-api.service';

describe('ChatbotController Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(ChatbotModule);

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

  describe('GET /chatbot/history', () => {
    it('should return the chatbot history for a user', async () => {
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
        questionText: 'What is AI?',
        responseText: 'AI stands for Artificial Intelligence.',
        verified: true,
        suggested: false,
        sourceDocuments: [],
        interaction: interaction,
      };
      await ChatbotQuestionModel.create(questionData).save();

      const response = await supertest({ userId: user.id })
        .get(`/chatbot/history`)
        .expect(200);

      expect(Array.isArray(response.body.history)).toBe(true);
      expect(response.body.history.length).toBeGreaterThan(0);

      const firstInteraction = response.body.history[0];
      expect(firstInteraction).toHaveProperty('id');
      expect(Array.isArray(firstInteraction.questions)).toBe(true);
      expect(firstInteraction.questions.length).toBeGreaterThan(0);

      const firstQuestion = firstInteraction.questions[0];
      expect(firstQuestion).toHaveProperty('id');
      expect(firstQuestion).toHaveProperty(
        'questionText',
        questionData.questionText,
      );
      expect(firstQuestion).toHaveProperty(
        'responseText',
        questionData.responseText,
      );
      expect(firstQuestion).toHaveProperty(
        'vectorStoreId',
        questionData.vectorStoreId,
      );
    });
  });

  const testUserUnauthorized = async (
    url: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    userId: number,
  ) => {
    switch (method) {
      case 'GET':
        return supertest({ userId }).get(url).expect(403);
      case 'POST':
        return supertest({ userId }).post(url).expect(403);
      case 'PATCH':
        return supertest({ userId }).patch(url).expect(403);
      case 'DELETE':
        return supertest({ userId }).delete(url).expect(403);
    }
  };

  const testRolesForbidden = async (
    url: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    organization: OrganizationModel,
    orgRoles: OrganizationRole[],
    course?: CourseModel,
    courseRoles?: Role[],
  ) => {
    for (const role of orgRoles) {
      const user = await OrganizationUserFactory.create({
        organization,
        role,
      });
      await testUserUnauthorized(url, method, user.userId);
    }
    if (courseRoles) {
      for (const role of courseRoles) {
        const user = await UserCourseFactory.create({
          course,
          role,
        });

        await OrganizationUserFactory.create({
          organization,
          organizationUser: user.user,
          role: OrganizationRole.MEMBER,
        });
        await testUserUnauthorized(url, method, user.userId);
      }
    }
  };

  let organization: OrganizationModel;
  let orgCourse: OrganizationCourseModel;

  beforeEach(async () => {
    organization = await OrganizationFactory.create();
    const course = await CourseFactory.create();
    orgCourse = await OrganizationCourseFactory.create({
      organization,
      course,
    });
  });

  const getChatbotSettingsDataSet = async () => {
    const organizationSettings =
      await OrganizationChatbotSettingsFactory.create({
        organization,
      });
    const provider = await ChatbotProviderFactory.create({
      organizationChatbotSettings: organizationSettings,
      providerType: ChatbotServiceProvider.Ollama,
      baseUrl: 'https://fake-url.com',
      nickname: 'Ollama Provider',
    });
    const llm = await LLMTypeFactory.create({
      provider,
    });
    provider.defaultModel = llm;
    provider.defaultVisionModel = llm;
    organizationSettings.defaultProvider = provider;
    await provider.save();
    await organizationSettings.save();
    return {
      organizationSettings,
      provider,
      llm,
    };
  };

  const getUser = async (role: OrganizationRole | Role, token = true) => {
    let user = await UserFactory.create();
    if (token) {
      await ChatTokenFactory.create({
        user,
      });
      user = await UserModel.findOne({
        where: { id: user.id },
        relations: { chat_token: true },
      });
    }
    if (Object.values(OrganizationRole).some((k) => k == role)) {
      await OrganizationUserFactory.create({
        organization,
        organizationUser: user,
        role: role as OrganizationRole,
      });
    } else {
      await OrganizationUserFactory.create({
        organization,
        organizationUser: user,
        role: OrganizationRole.MEMBER,
      });
    }
    if (Object.values(Role).some((k) => k == role)) {
      await UserCourseFactory.create({
        course: orgCourse.course,
        user,
        role: role as Role,
      });
    }
    return user;
  };

  describe('GET organization/:oid', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if does not exist', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .get(`/chatbot/organization/${organization.id}`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });

    it('should return organization settings', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await OrganizationChatbotSettingsFactory.create({
        organization,
      });
      const res = await supertest({ userId: user.id })
        .get(`/chatbot/organization/${organization.id}`)
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('POST organization/:oid', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if settings for org already exist', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await OrganizationChatbotSettingsFactory.create({
        organization,
      });
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}`)
        .expect(400);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.organizationSettingsAlreadyExists,
      );
    });

    it('should create organization settings', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const params: CreateOrganizationChatbotSettingsBody = {
        providers: [
          {
            providerType: ChatbotServiceProvider.Ollama,
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
                isText: false,
                isVision: true,
                isThinking: false,
              },
            ],
          },
        ],
      } satisfies CreateOrganizationChatbotSettingsBody;
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}`)
        .send(params)
        .expect(201);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('PATCH organization/:oid', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}`,
        'PATCH',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if organization settings not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .patch(`/chatbot/organization/${organization.id}`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });

    it('should update organization settings', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await OrganizationChatbotSettingsFactory.create({
        organization,
      });

      const params = {
        default_prompt: 'prompt',
        default_temperature: 0.5,
        default_topK: 3,
        default_similarityThresholdDocuments: 0.5,
        default_similarityThresholdQuestions: 0.7,
      };
      const res = await supertest({ userId: user.id })
        .patch(`/chatbot/organization/${organization.id}`)
        .send(params)
        .expect(200);
      expect(
        pick(res.body, [
          'default_prompt',
          'default_temperature',
          'default_topK',
          'default_similarityThresholdDocuments',
          'default_similarityThresholdQuestions',
        ]),
      ).toEqual(params);
    });
  });

  describe('DELETE organization/:oid', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}`,
        'DELETE',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if organization settings not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });

    it('should fail if user has no chat token', async () => {
      const user = await getUser(OrganizationRole.ADMIN, false);
      await OrganizationChatbotSettingsFactory.create({
        organization,
      });
      await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}`)
        .expect(403);
    });

    it('should delete the organization settings', async () => {
      const spy0: jest.SpyInstance = jest.spyOn(
        ChatbotApiService.prototype,
        'resetChatbotSettings',
      );
      spy0.mockResolvedValue(undefined);
      const spy1: jest.SpyInstance = jest.spyOn(
        ChatbotApiService.prototype,
        'updateChatbotSettings',
      );
      spy1.mockResolvedValue(undefined);
      const user = await getUser(OrganizationRole.ADMIN);
      const organizationSettings =
        await OrganizationChatbotSettingsFactory.create({
          organization,
        });
      await CourseChatbotSettingsFactory.create({
        course: orgCourse.course,
        organizationSettings,
      });
      await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}`)
        .expect(200);
      expect(spy0).toHaveBeenCalledTimes(1);
      expect(spy0).toHaveBeenCalledWith(
        orgCourse.courseId,
        user.chat_token.token,
      );
      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy1).toHaveBeenCalledWith(
        {
          prompt:
            'You are a course help assistant for a course. Here are some rules for question answering:  1) You may use markdown for styling your answers. 2) Refer to context when you see fit. 3) Try not giving the assignment question answers directly to students, instead provide hints.',
          similarityThresholdDocuments: 0.55,
          similarityThresholdQuestions: 0.9,
          temperature: 0.7,
          topK: 5,
        },
        orgCourse.courseId,
        user.chat_token.token,
      );
      expect(
        await OrganizationChatbotSettingsModel.findOne({
          where: { organizationId: organization.id },
        }),
      ).toBeFalsy();
    });
  });

  describe('GET organization/:oid/course', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/course`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should return any course settings for the organization', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const { organizationSettings, llm } = await getChatbotSettingsDataSet();
      await CourseChatbotSettingsFactory.createList(3, {
        organizationSettings,
        llmModel: llm,
      });
      const res = await supertest({ userId: user.id })
        .get(`/chatbot/organization/${organization.id}/course`)
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('GET organization/:oid/provider', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/provider`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should return organization providers', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await getChatbotSettingsDataSet();
      const res = await supertest({ userId: user.id })
        .get(`/chatbot/organization/${organization.id}/provider`)
        .expect(200);
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('POST organization/:oid/provider', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/provider`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if necessary params are missing', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          defaultModelName: '',
          defaultVisionModelName: '',
          providerType: ChatbotServiceProvider.Ollama,
        })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          models: [],
          defaultVisionModelName: '',
          providerType: ChatbotServiceProvider.Ollama,
        })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          defaultModelName: '',
          models: [],
          providerType: ChatbotServiceProvider.Ollama,
        })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({ defaultModelName: '', models: [], defaultVisionModelName: '' })
        .expect(400);
    });

    it('should fail if organization settings not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          models: [],
          defaultModelName: '',
          defaultVisionModelName: '',
          providerType: ChatbotServiceProvider.Ollama,
        })
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
      );
    });

    it('should create chatbot provider', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await getChatbotSettingsDataSet();
      const params = {
        providerType: ChatbotServiceProvider.Ollama,
        baseUrl: 'https://fake-url.com',
        headers: { Authorization: 'Bearer fake-key' },
        nickname: 'Ollama Provider',
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
            isText: false,
            isVision: true,
            isThinking: false,
          },
        ],
        defaultModelName: 'model1',
        defaultVisionModelName: 'model2',
      } satisfies CreateChatbotProviderBody;
      const props = ['providerType', 'baseUrl', 'headers', 'nickname'];
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send(params)
        .expect(201);
      expect(pick(res.body, props)).toEqual(pick(params, props));
    });
  });

  describe('PATCH organization/:oid/provider/:providerId', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/provider/0`,
        'PATCH',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if provider is not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .patch(`/chatbot/organization/${organization.id}/provider/0`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    });

    it('should update the provider', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      let { provider } = await getChatbotSettingsDataSet();

      provider = await ChatbotProviderModel.findOne({
        where: { id: provider.id },
        relations: {
          defaultModel: true,
          defaultVisionModel: true,
          availableModels: true,
        },
      });

      const originalIds = provider.availableModels.map((i) => i.id);
      let newDefaultText: LLMTypeModel;
      let newDefaultVision: LLMTypeModel;

      for (let i = 3; i <= 5; i++) {
        const llm = await LLMTypeFactory.create({
          modelName: `model${i}`,
          isText: i % 2 == 0,
          isVision: i % 2 != 0,
          isThinking: false,
        });
        if (!newDefaultText && llm.isText) newDefaultText = llm;
        if (!newDefaultVision && llm.isVision) newDefaultVision = llm;
      }
      await provider.reload();
      const params: UpdateChatbotProviderBody = {
        baseUrl: 'https://new-url/',
        defaultModelId: newDefaultText.id,
        defaultVisionModelId: newDefaultVision.id,
        deletedModels: originalIds,
        addedModels: [
          {
            modelName: 'model6',
            isRecommended: false,
            isText: true,
            isVision: false,
            isThinking: true,
          },
        ],
      };
      const props = ['baseUrl', 'defaultModelId', 'defaultVisionModelId'];
      const res = await supertest({ userId: user.id })
        .patch(
          `/chatbot/organization/${organization.id}/provider/${provider.id}`,
        )
        .send(params);
      //.expect(200);
      console.log(res.status, res.body);
      expect(pick(res.body, props)).toEqual(pick(params, props));
      expect(res.body).toMatchSnapshot();
    });
  });

  describe('DELETE organization/:oid/provider/:providerId', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/provider/0`,
        'DELETE',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if provider is not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}/provider/0`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    });

    it('should delete provider', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const { provider, llm } = await getChatbotSettingsDataSet();
      const provider1 = await ChatbotProviderFactory.create({
        ...pick(provider, [
          'providerType',
          'nickname',
          'baseUrl',
          'organizationChatbotSettings',
        ]),
      });
      const llm1 = await LLMTypeFactory.create({
        provider: provider1,
        ...pick(llm, ['modelName', 'isThinking', 'isText', 'isVision']),
      });
      provider1.defaultModel = llm1;
      provider1.defaultVisionModel = llm1;
      await provider1.save();

      await supertest({ userId: user.id })
        .delete(
          `/chatbot/organization/${organization.id}/provider/${provider1.id}`,
        )
        .expect(200);
      expect(
        await ChatbotProviderModel.findOne({ where: { id: provider1.id } }),
      ).toBeFalsy();
    });
  });

  describe('POST organization/:oid/model', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/model`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if missing parameters', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send({ isText: true, isVision: false, isThinking: false })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send({ modelName: 'new-model', isVision: false, isThinking: false })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send({ modelName: 'new-model', isText: false, isThinking: false })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send({ modelName: 'new-model', isText: true, isVision: false })
        .expect(400);
    });

    it('should fail if provider is not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send({
          modelName: 'new-model',
          isRecommended: false,
          isText: true,
          isVision: false,
          isThinking: false,
        })
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    });

    it('should create LLM type', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const { provider } = await getChatbotSettingsDataSet();
      const params = {
        providerId: provider.id,
        modelName: 'new-model',
        isRecommended: false,
        isText: true,
        isVision: false,
        isThinking: true,
      };
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/model`)
        .send(params)
        .expect(201);
      expect(pick(res.body, Object.keys(params))).toEqual(params);
    });
  });

  describe('PATCH organization/:oid/model/:modelId', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/model/0`,
        'PATCH',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if model is not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .patch(`/chatbot/organization/${organization.id}/model/0`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.modelNotFound,
      );
    });

    it('should update model', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const { llm } = await getChatbotSettingsDataSet();
      const params = {
        modelName: 'new-model-name',
        isText: false,
        isVision: false,
        isThinking: true,
      };
      const props = ['modelName', 'isText', 'isVision', 'isThinking'];

      const res = await supertest({ userId: user.id })
        .patch(`/chatbot/organization/${organization.id}/model/${llm.id}`)
        .send(params)
        .expect(200);
      expect(pick(res.body, props)).toEqual(params);
    });
  });

  describe('DELETE organization/:oid/model/:modelId', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/model/0`,
        'DELETE',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if model is not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}/model/0`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.modelNotFound,
      );
    });

    it('should delete model', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const { provider, llm } = await getChatbotSettingsDataSet();
      const llm1 = await LLMTypeFactory.create({
        ...llm,
        id: undefined,
        provider: provider,
      });
      await supertest({ userId: user.id })
        .delete(`/chatbot/organization/${organization.id}/model/${llm1.id}`)
        .expect(200);
      expect(
        await LLMTypeModel.findOne({ where: { id: llm1.id } }),
      ).toBeFalsy();
    });
  });

  describe('GET course/:courseId', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await OrganizationCourseFactory.create({
        organization,
      });
      await course.reload();
      await testRolesForbidden(
        `/chatbot/course/${course.courseId}`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course.course,
        [Role.STUDENT],
      );
    });

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should fail if organization settings not found (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}`)
          .expect(404);
        expect(res.body).toHaveProperty(
          'message',
          ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
        );
      },
    );

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should upsert if course settings not found (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const upsertSpy = jest.spyOn(
          ChatbotService.prototype,
          'upsertCourseSetting',
        );
        await getChatbotSettingsDataSet();
        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}`)
          .expect(200);
        expect(res.body).toMatchSnapshot();
        expect(upsertSpy).toHaveBeenCalledTimes(1);
        upsertSpy.mockRestore();
      },
    );

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should return course settings (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const upsertSpy = jest.spyOn(
          ChatbotService.prototype,
          'upsertCourseSetting',
        );
        const { organizationSettings, llm } = await getChatbotSettingsDataSet();
        await CourseChatbotSettingsFactory.create({
          organizationSettings: organizationSettings,
          llmModel: llm,
          course: orgCourse.course,
        });
        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}`)
          .expect(200);
        expect(res.body).toMatchSnapshot();
        expect(upsertSpy).not.toHaveBeenCalled();
        upsertSpy.mockRestore();
      },
    );
  });

  describe('GET course/:courseId/service', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      await testRolesForbidden(
        `/chatbot/course/${course.id}/service`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course,
        [Role.STUDENT],
      );
    });

    it.each([
      {
        type: ChatbotServiceType.LATEST,
        str: 'exists',
        role: OrganizationRole.ADMIN,
      },
      {
        type: ChatbotServiceType.LATEST,
        str: 'exists',
        role: Role.PROFESSOR,
      },
      {
        type: ChatbotServiceType.LATEST,
        str: 'exists',
        role: Role.TA,
      },
      {
        type: ChatbotServiceType.LEGACY,
        str: 'exists',
        role: OrganizationRole.ADMIN,
      },
      {
        type: ChatbotServiceType.LEGACY,
        str: 'exists',
        role: Role.PROFESSOR,
      },
      {
        type: ChatbotServiceType.LEGACY,
        str: 'exists',
        role: Role.TA,
      },
    ])(
      'should return service type %s',
      async ({
        type,
        role,
      }: {
        type: ChatbotServiceType;
        role: OrganizationRole | Role;
      }) => {
        const user = await getUser(role);
        if (type == ChatbotServiceType.LATEST) {
          await OrganizationChatbotSettingsFactory.create({
            organization,
          });
        }
        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}/service`)
          .expect(200);
        expect(res.text).toEqual(type);
      },
    );
  });

  describe('POST course/:courseId', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      await testRolesForbidden(
        `/chatbot/course/${course.id}`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course,
        [Role.STUDENT],
      );
    });

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should fail if org settings doesnt exist (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const res = await supertest({ userId: user.id })
          .post(`/chatbot/course/${orgCourse.courseId}`)
          .expect(404);
        expect(res.body).toHaveProperty(
          'message',
          ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
        );
      },
    );

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should create or update and return course settings (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const updateSpy = jest.spyOn(CourseChatbotSettingsModel, 'update');
        const saveSpy = jest.spyOn(CourseChatbotSettingsModel, 'save');
        const { organizationSettings, llm } = await getChatbotSettingsDataSet();

        const llm1 = await LLMTypeFactory.create({
          ...llm,
          id: undefined,
          modelName: 'new-model',
        });
        const params = {
          llmId: llm1.id,
          prompt: 'prompt',
          temperature: 0.5,
          topK: 3,
          similarityThresholdDocuments: 0.65,
        };

        const defaults = {
          ...CourseChatbotSettingsModel.getDefaults(),
          ...dropUndefined(organizationSettings.transformDefaults()),
        };

        let res = await supertest({ userId: user.id })
          .post(`/chatbot/course/${orgCourse.courseId}`)
          .send({})
          .expect(201);

        const props = Object.keys(params);
        const usingProps = [
          'usingDefaultModel',
          'usingDefaultPrompt',
          'usingDefaultTemperature',
          'usingDefaultTopK',
          'usingDefaultSimilarityThresholdDocuments',
          'usingDefaultSimilarityThresholdQuestions',
        ];
        let expectUsing: Record<string, boolean> = {};
        usingProps.forEach((k) => (expectUsing[k] = true));
        expect(pick(res.body, props)).toEqual(
          pick(
            defaults,
            props.filter((k) => k != 'similarityThresholdQuestions'),
          ),
        );
        expect(pick(res.body, usingProps)).toEqual(expectUsing);
        expect(saveSpy).toHaveBeenCalledTimes(1);
        expect(updateSpy).not.toHaveBeenCalled();
        saveSpy.mockClear();
        updateSpy.mockClear();

        res = await supertest({ userId: user.id })
          .post(`/chatbot/course/${orgCourse.courseId}`)
          .send(params)
          .expect(201);

        expect(pick(res.body, props)).toEqual(params);
        expectUsing = {};
        usingProps.forEach(
          (k, i) => (expectUsing[k] = i >= usingProps.length - 1),
        );
        expect(pick(res.body, usingProps)).toEqual(expectUsing);
        saveSpy.mockRestore();
        updateSpy.mockRestore();
      },
    );
  });

  describe('PATCH course/:courseId/reset', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      await testRolesForbidden(
        `/chatbot/course/${course.id}/reset`,
        'PATCH',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course,
        [Role.STUDENT],
      );
    });

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should reset course settings to defaults (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const { organizationSettings, llm } = await getChatbotSettingsDataSet();
        const llm1 = await LLMTypeFactory.create({
          ...llm,
          id: undefined,
          modelName: 'new-model',
        });
        const params = {
          prompt: 'prompt',
          temperature: 0.5,
          topK: 3,
          similarityThresholdDocuments: 0.65,
          similarityThresholdQuestions: 0.6,
        };
        const usingParams = {
          usingDefaultModel: false,
          usingDefaultPrompt: false,
          usingDefaultTopK: false,
          usingDefaultTemperature: false,
          usingDefaultSimilarityThresholdDocuments: false,
          usingDefaultSimilarityThresholdQuestions: false,
        };

        await CourseChatbotSettingsFactory.create({
          organizationSettings,
          llmModel: llm1,
          course: orgCourse.course,
          ...params,
          ...usingParams,
        });
        const props = ['llmId', ...Object.keys(params)];
        const usingProps = Object.keys(usingParams);

        const defaults = {
          ...CourseChatbotSettingsModel.getDefaults(),
          ...dropUndefined(organizationSettings.transformDefaults()),
        };

        const res = await supertest({ userId: user.id })
          .patch(`/chatbot/course/${orgCourse.courseId}/reset`)
          .expect(200);
        expect(pick(res.body, props)).toEqual(defaults);
        const expectUsing: Record<string, boolean> = {};
        usingProps.forEach((k) => (expectUsing[k] = true));
        expect(pick(res.body, usingProps)).toEqual(expectUsing);
      },
    );
  });

  describe('GET course/:courseId/default', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      await testRolesForbidden(
        `/chatbot/course/${course.id}/default`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course,
        [Role.STUDENT],
      );
    });

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should return defaults for course based on organization and constants (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const { organizationSettings, llm } = await getChatbotSettingsDataSet();
        await CourseChatbotSettingsFactory.create({
          organizationSettings,
          llmModel: llm,
          course: orgCourse.course,
        });

        const defaults = {
          ...CourseChatbotSettingsModel.getDefaults(),
          ...dropUndefined(organizationSettings.transformDefaults()),
        };

        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}/default`)
          .expect(200);

        expect(res.body).toEqual(defaults);
      },
    );
  });

  describe('GET course/:courseId/provider', () => {
    it('should fail if accessing user is not an admin or course prof/ta', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();
      await OrganizationCourseFactory.create({
        organization,
        course,
      });
      await testRolesForbidden(
        `/chatbot/course/${course.id}/provider`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
        course,
        [Role.STUDENT],
      );
    });

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should fail if org settings not found (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}/provider`)
          .expect(404);
        expect(res.body).toHaveProperty(
          'message',
          ERROR_MESSAGES.chatbotController.organizationSettingsNotFound,
        );
      },
    );

    it.each([OrganizationRole.ADMIN, Role.PROFESSOR, Role.TA])(
      'should get list of providers from organization (ROLE: %s)',
      async (role: OrganizationRole | Role) => {
        const user = await getUser(role);
        const { provider, llm } = await getChatbotSettingsDataSet();
        for (let i = 0; i < 3; i++) {
          const newProvider = await ChatbotProviderFactory.create({
            ...provider,
            id: undefined,
            hasApiKey: undefined,
            providerType:
              i % 2 == 0
                ? ChatbotServiceProvider.Ollama
                : ChatbotServiceProvider.OpenAI,
            defaultVisionModel: undefined,
            defaultModel: undefined,
            defaultModelId: undefined,
            defaultVisionModelId: undefined,
          });

          for (let j = 0; i < 2; i++) {
            const newLLM = await LLMTypeFactory.create({
              ...llm,
              id: undefined,
              provider: newProvider,
              modelName: `new-model-${j + 1}`,
            });
            if (j % 2 == 0) {
              newProvider.defaultModel = newLLM;
            } else {
              newProvider.defaultVisionModel = newLLM;
            }
          }
          await newProvider.save();
        }

        const res = await supertest({ userId: user.id })
          .get(`/chatbot/course/${orgCourse.courseId}/provider`)
          .expect(200);

        expect(res.body).toMatchSnapshot();
      },
    );
  });

  const getAvailableModelsTest = async (
    user: UserModel,
    provider: ChatbotServiceProvider,
    method: 'GET' | 'POST' = 'GET',
    passedUrl?: string,
  ) => {
    const url =
      passedUrl ?? `/chatbot/organization/${organization.id}/${provider}`;
    const mock = jest.fn();
    const originalOllama = ChatbotService.prototype.getOllamaAvailableModels;
    const originalOpenAI = ChatbotService.prototype.getOpenAIAvailableModels;
    ChatbotService.prototype.getOllamaAvailableModels = mock;
    ChatbotService.prototype.getOpenAIAvailableModels = mock;

    mock.mockResolvedValue([
      [1, 2, 3].map((v) => ({
        parameterSize: '0M',
        families: [`${provider}`],
        id: v,
        modelName: `${provider}-model-${v}`,
        isText: false,
        isVision: false,
        isThinking: false,
        provider: undefined as any,
      })),
    ]);

    let res: any;
    switch (method) {
      case 'POST':
        res = await supertest({ userId: user.id })
          .post(url)
          .send({ baseUrl: 'https://fake-url.com', apiKey: 'abcdefghijklmnop' })
          .expect(201);
        break;
      case 'GET':
        res = await supertest({ userId: user.id }).get(url).expect(200);
        break;
    }
    expect(res.body).toMatchSnapshot();

    ChatbotService.prototype.getOllamaAvailableModels = originalOllama;
    ChatbotService.prototype.getOpenAIAvailableModels = originalOpenAI;
    mock.mockClear();
  };

  describe('POST organization/:oid/ollama', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/ollama`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if baseUrl is omitted', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/ollama`)
        .expect(400);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['Base URL']),
      );
    });

    it('should return a series of LLM descriptions from Ollama', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await getAvailableModelsTest(user, ChatbotServiceProvider.Ollama, 'POST');
    });
  });

  describe('POST organization/:oid/openai', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/openai`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if apiKey is omitted', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/openai`)
        .expect(400);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['API Key']),
      );
    });

    it('should return a series of LLM descriptions about OpenAI models', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await getAvailableModelsTest(user, ChatbotServiceProvider.OpenAI, 'POST');
    });
  });

  describe('GET organization/:oid/provider/:providerId/available', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/provider/0/available`,
        'GET',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if provider not found', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .get(`/chatbot/organization/${organization.id}/provider/0/available`)
        .expect(404);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.chatbotProviderNotFound,
      );
    });

    it.each([ChatbotServiceProvider.Ollama, ChatbotServiceProvider.OpenAI])(
      'should return the available models for the provider (%s)',
      async (type) => {
        const user = await getUser(OrganizationRole.ADMIN);
        const { provider } = await getChatbotSettingsDataSet();
        await getAvailableModelsTest(
          user,
          type,
          'GET',
          `/chatbot/organization/${organization.id}/provider/${provider.id}/available`,
        );
      },
    );
  });
});
