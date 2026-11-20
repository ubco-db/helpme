import { ChatbotModule } from 'chatbot/chatbot.module';
import {
  ChatbotServiceProvider,
  ChatbotServiceType,
  dropUndefined,
  ERROR_MESSAGES,
  OrganizationRole,
  Role,
} from '@koh/common';
import {
  ChatbotProviderFactory,
  ChatTokenFactory,
  CourseChatbotSettingsFactory,
  CourseFactory,
  LLMTypeFactory,
  OrganizationChatbotSettingsFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import type { OrganizationModel } from '../src/organization/organization.entity';
import type { CourseModel } from '../src/course/course.entity';
import type { OrganizationCourseModel } from '../src/organization/organization-course.entity';
import { pick } from 'lodash';
import { ChatbotService } from '../src/chatbot/chatbot.service';
import { CourseChatbotSettingsModel } from '../src/chatbot/chatbot-infrastructure-models/course-chatbot-settings.entity';
import { UserModel } from '../src/profile/user.entity';

// This suite is split across multiple files for performance: Jest runs test
// files in parallel (one per worker) but tests within each file sequentially.
// This file was one of the slowest integration suites, so its tests are split
// roughly 60/40 by runtime between part1 and part2. Add new tests here rather
// than to part1.
describe('ChatbotController Integration', () => {
  const { supertest } = setupIntegrationTest(ChatbotModule);

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
      providerType: ChatbotServiceProvider.LocalLLM,
      baseUrl: 'https://fake-url.com',
      nickname: 'LocalLLM Provider',
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

  const getAvailableModelsTest = async (
    user: UserModel,
    provider: ChatbotServiceProvider,
    method: 'GET' | 'POST' = 'GET',
    passedUrl?: string,
  ) => {
    const url =
      passedUrl ?? `/chatbot/organization/${organization.id}/${provider}`;
    const mock = jest.fn();
    const originalLocalLLM =
      ChatbotService.prototype.getLocalLLMAvailableModels;
    const originalOpenAI = ChatbotService.prototype.getOpenAIAvailableModels;
    ChatbotService.prototype.getLocalLLMAvailableModels = mock;
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

    ChatbotService.prototype.getLocalLLMAvailableModels = originalLocalLLM;
    ChatbotService.prototype.getOpenAIAvailableModels = originalOpenAI;
    mock.mockClear();
  };

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
                ? ChatbotServiceProvider.LocalLLM
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

  describe('POST organization/:oid/local_llm', () => {
    it('should fail if accessing user is not an admin', async () => {
      const organization = await OrganizationFactory.create();
      await testRolesForbidden(
        `/chatbot/organization/${organization.id}/local_llm`,
        'POST',
        organization,
        [OrganizationRole.PROFESSOR, OrganizationRole.MEMBER],
      );
    });

    it('should fail if baseUrl is omitted', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      const res = await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/local_llm`)
        .expect(400);
      expect(res.body).toHaveProperty(
        'message',
        ERROR_MESSAGES.chatbotController.invalidProviderParams(['Base URL']),
      );
    });

    it('should return a series of LLM descriptions from local_llm', async () => {
      const user = await getUser(OrganizationRole.ADMIN);
      await getAvailableModelsTest(
        user,
        ChatbotServiceProvider.LocalLLM,
        'POST',
      );
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

    it.each([ChatbotServiceProvider.LocalLLM, ChatbotServiceProvider.OpenAI])(
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
