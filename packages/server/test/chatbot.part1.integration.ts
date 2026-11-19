import { ChatbotModule } from 'chatbot/chatbot.module';
import type {
  ChatbotAskSuggestedParams,
  CreateChatbotProviderBody,
  CreateOrganizationChatbotSettingsBody,
  UpdateChatbotProviderBody,
} from '@koh/common';
import {
  ChatbotServiceProvider,
  ERROR_MESSAGES,
  OrganizationRole,
  Role,
  SuperCoursePurpose,
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
import type { OrganizationModel } from '../src/organization/organization.entity';
import type { CourseModel } from '../src/course/course.entity';
import type { OrganizationCourseModel } from '../src/organization/organization-course.entity';
import { pick } from 'lodash';
import { OrganizationChatbotSettingsModel } from '../src/chatbot/chatbot-infrastructure-models/organization-chatbot-settings.entity';
import { LLMTypeModel } from '../src/chatbot/chatbot-infrastructure-models/llm-type.entity';
import { ChatbotProviderModel } from '../src/chatbot/chatbot-infrastructure-models/chatbot-provider.entity';
import { DEFAULT_CHATBOT_PROMPT } from '../src/chatbot/chatbot-infrastructure-models/course-chatbot-settings.entity';
import { UserModel } from '../src/profile/user.entity';
import { ChatbotApiService } from '../src/chatbot/chatbot-api.service';
import { SuperCourseModel } from '../src/course/super-course.entity';

// This suite is split across multiple files for performance: Jest runs test
// files in parallel (one per worker) but tests within each file sequentially.
// This file was one of the slowest integration suites, so its tests are split
// roughly 60/40 by runtime between part1 and part2.
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

    it('should allow a parent course member to ask a suggested question in an agent course', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const parentCourse = await CourseFactory.create({ name: 'LANTERN' });
      const agentCourse = await CourseFactory.create({
        name: 'LANTERN Analyst',
        chatbotAgentName: 'Analyst',
      });
      await UserCourseFactory.create({
        user,
        course: parentCourse,
        role: Role.STUDENT,
      });

      const agentGroup = await SuperCourseModel.create({
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        organization,
      }).save();
      agentGroup.courses = [parentCourse, agentCourse];
      await agentGroup.save();

      const body: ChatbotAskSuggestedParams = {
        question: 'How do I evaluate a research article?',
        responseText: 'Start with the study design and methods.',
        vectorStoreId: 'agent-question-1',
      };

      const response = await supertest({ userId: user.id })
        .post(`/chatbot/askSuggested/${agentCourse.id}`)
        .send(body)
        .expect(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.questionText).toEqual(body.question);
      expect(response.body.responseText).toEqual(body.responseText);
      expect(response.body.vectorStoreId).toEqual(body.vectorStoreId);
      expect(response.body.interactionId).toBeDefined();
    });

    it('should block agent course access when the user is not in the parent course', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const parentCourse = await CourseFactory.create({ name: 'LANTERN' });
      const agentCourse = await CourseFactory.create({
        name: 'LANTERN Analyst',
        chatbotAgentName: 'Analyst',
      });

      const agentGroup = await SuperCourseModel.create({
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        organization,
      }).save();
      agentGroup.courses = [parentCourse, agentCourse];
      await agentGroup.save();

      const body: ChatbotAskSuggestedParams = {
        question: 'How do I evaluate a research article?',
        responseText: 'Start with the study design and methods.',
        vectorStoreId: 'agent-question-1',
      };

      await supertest({ userId: user.id })
        .post(`/chatbot/askSuggested/${agentCourse.id}`)
        .send(body)
        .expect(404);
    });
  });

  describe('GET /chatbot/course/:courseId/agents', () => {
    it('should return an empty list for a course without chatbot agents', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user,
        course,
        role: Role.STUDENT,
      });

      const response = await supertest({ userId: user.id })
        .get(`/chatbot/course/${course.id}/agents`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return sorted chatbot agents for a parent course member', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const parentCourse = await CourseFactory.create({ name: 'LANTERN' });
      const analystCourse = await CourseFactory.create({
        name: 'LANTERN Analyst',
        chatbotAgentName: 'Analyst',
        chatbotAgentDescription: 'Research methods and critical appraisal.',
        chatbotAgentOrder: 1,
      });
      const strategistCourse = await CourseFactory.create({
        name: 'LANTERN Strategist',
        chatbotAgentName: 'Strategist',
        chatbotAgentDescription: 'Grantsmanship and project planning.',
        chatbotAgentOrder: 2,
      });
      const thriveCourse = await CourseFactory.create({
        name: 'LANTERN Thrive',
        chatbotAgentName: 'Thrive',
        chatbotAgentDescription: 'Academic culture and career planning.',
        chatbotAgentOrder: 3,
      });
      await UserCourseFactory.create({
        user,
        course: parentCourse,
        role: Role.STUDENT,
      });

      const agentGroup = await SuperCourseModel.create({
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        organization,
      }).save();
      agentGroup.courses = [
        parentCourse,
        strategistCourse,
        thriveCourse,
        analystCourse,
      ];
      await agentGroup.save();

      const response = await supertest({ userId: user.id })
        .get(`/chatbot/course/${parentCourse.id}/agents`)
        .expect(200);

      expect(response.body).toEqual([
        {
          courseId: analystCourse.id,
          name: analystCourse.name,
          agentName: analystCourse.chatbotAgentName,
          description: analystCourse.chatbotAgentDescription,
          order: analystCourse.chatbotAgentOrder,
        },
        {
          courseId: strategistCourse.id,
          name: strategistCourse.name,
          agentName: strategistCourse.chatbotAgentName,
          description: strategistCourse.chatbotAgentDescription,
          order: strategistCourse.chatbotAgentOrder,
        },
        {
          courseId: thriveCourse.id,
          name: thriveCourse.name,
          agentName: thriveCourse.chatbotAgentName,
          description: thriveCourse.chatbotAgentDescription,
          order: thriveCourse.chatbotAgentOrder,
        },
      ]);
    });

    it('should hide archived agents unless the parent course is archived', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const parentCourse = await CourseFactory.create({
        name: 'LANTERN',
        enabled: true,
      });
      const activeAgentCourse = await CourseFactory.create({
        name: 'LANTERN Analyst',
        enabled: true,
        chatbotAgentName: 'Analyst',
        chatbotAgentDescription: 'Research methods and critical appraisal.',
        chatbotAgentOrder: 1,
      });
      const archivedAgentCourse = await CourseFactory.create({
        name: 'LANTERN Strategist',
        enabled: false,
        chatbotAgentName: 'Strategist',
        chatbotAgentDescription: 'Grantsmanship and project planning.',
        chatbotAgentOrder: 2,
      });
      await UserCourseFactory.create({
        user,
        course: parentCourse,
        role: Role.STUDENT,
      });

      const agentGroup = await SuperCourseModel.create({
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        organization,
      }).save();
      agentGroup.courses = [
        parentCourse,
        activeAgentCourse,
        archivedAgentCourse,
      ];
      await agentGroup.save();

      const activeParentResponse = await supertest({ userId: user.id })
        .get(`/chatbot/course/${parentCourse.id}/agents`)
        .expect(200);
      expect(activeParentResponse.body.map((agent) => agent.courseId)).toEqual([
        activeAgentCourse.id,
      ]);

      parentCourse.enabled = false;
      await parentCourse.save();

      const archivedParentResponse = await supertest({ userId: user.id })
        .get(`/chatbot/course/${parentCourse.id}/agents`)
        .expect(200);
      expect(
        archivedParentResponse.body.map((agent) => agent.courseId),
      ).toEqual([activeAgentCourse.id, archivedAgentCourse.id]);
    });

    it('should block users who are not in the parent course', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();
      const parentCourse = await CourseFactory.create({ name: 'LANTERN' });
      const analystCourse = await CourseFactory.create({
        name: 'LANTERN Analyst',
        chatbotAgentName: 'Analyst',
      });

      const agentGroup = await SuperCourseModel.create({
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        organization,
      }).save();
      agentGroup.courses = [parentCourse, analystCourse];
      await agentGroup.save();

      await supertest({ userId: user.id })
        .get(`/chatbot/course/${parentCourse.id}/agents`)
        .expect(404);
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
            providerType: ChatbotServiceProvider.LocalLLM,
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
      const user = await getUser(OrganizationRole.ADMIN);
      const organizationSettings =
        await OrganizationChatbotSettingsFactory.create({
          organization,
        });
      await CourseChatbotSettingsFactory.create({
        course: orgCourse.course,
        organizationSettings,
      });
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
          prompt: DEFAULT_CHATBOT_PROMPT,
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
          providerType: ChatbotServiceProvider.LocalLLM,
        })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          models: [],
          defaultVisionModelName: '',
          providerType: ChatbotServiceProvider.LocalLLM,
        })
        .expect(400);
      await supertest({ userId: user.id })
        .post(`/chatbot/organization/${organization.id}/provider`)
        .send({
          defaultModelName: '',
          models: [],
          providerType: ChatbotServiceProvider.LocalLLM,
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
          providerType: ChatbotServiceProvider.LocalLLM,
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
        providerType: ChatbotServiceProvider.LocalLLM,
        baseUrl: 'https://fake-url.com',
        headers: { Authorization: 'Bearer fake-key' },
        nickname: 'LocalLLM Provider',
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
        .send(params)
        .expect(200);
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

  // DO NOT ADD MORE TESTS TO THIS FILE. It is the larger half of a split
  // suite and will become the bottleneck again. Add new tests to
  // chatbot.part2.integration.ts instead.
});
