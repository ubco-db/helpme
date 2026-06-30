import { ChatbotServiceProvider } from '@koh/common';
import { CourseModel } from '../../server/src/course/course.entity';
import { QuestionModel } from '../../server/src/question/question.entity';
import { SeedModule } from '../../server/src/seed/seed.module';
import { SeedChatbotAgentGroupCommand } from '../../server/src/seed/seed-chatbot-agent-group.command';
import { CourseChatbotSettingsModel } from '../../server/src/chatbot/chatbot-infrastructure-models/course-chatbot-settings.entity';
import {
  ChatbotProviderFactory,
  CourseFactory,
  LLMTypeFactory,
  OrganizationChatbotSettingsFactory,
  OrganizationFactory,
  QuestionFactory,
  QueueFactory,
  SemesterFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { In } from 'typeorm';

describe('Seed Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(SeedModule);
  it('GET /seeds/delete', async () => {
    const course = await CourseFactory.create({});

    const queue = await QueueFactory.create({
      room: 'WHV 101',
      course: course,
    });

    await QuestionFactory.create({ queue: queue });
    await QuestionFactory.create({ queue: queue });
    await QuestionFactory.create({ queue: queue });

    const response = await supertest().get('/seeds/delete').expect(200);

    expect(response.text).toBe('Data successfully reset');
  });

  it('GET /seeds/create', async () => {
    await CourseFactory.create();
    const response = await supertest().get('/seeds/create').expect(200);

    expect(response.text).toBe('Data successfully seeded');

    const numQuestions = await QuestionModel.count();
    expect(numQuestions).toBe(4);
  });

  it('seed:chatbot-agent-group creates DB-backed prompts for LANTERN agent courses', async () => {
    const organization = await OrganizationFactory.create({ name: 'UBC' });
    await SemesterFactory.create({
      name: '2026S Both Terms',
      organization,
    });
    const organizationChatbotSettings =
      await OrganizationChatbotSettingsFactory.create({ organization });
    const provider = await ChatbotProviderFactory.create({
      organizationChatbotSettings,
      providerType: ChatbotServiceProvider.Ollama,
    });
    const defaultModel = await LLMTypeFactory.create({
      provider,
      modelName: 'model1',
      isText: true,
      isVision: false,
      isThinking: false,
    });
    provider.defaultModelId = defaultModel.id;
    await provider.save();
    organizationChatbotSettings.defaultProviderId = provider.id;
    await organizationChatbotSettings.save();

    const command = getTestModule().get(SeedChatbotAgentGroupCommand);
    await command.createLanternAgentGroup();

    const agentCourses = await CourseModel.find({
      where: {
        name: In([
          'LANTERN Analyst',
          'LANTERN Communicator',
          'LANTERN Strategist',
          'LANTERN Thrive',
        ]),
      },
    });
    const courseSettings = await CourseChatbotSettingsModel.find({
      where: { courseId: In(agentCourses.map((course) => course.id)) },
      relations: { course: true },
      order: { courseId: 'ASC' },
    });

    expect(courseSettings).toHaveLength(4);
    expect(
      courseSettings.map((settings) => settings.course.name).sort(),
    ).toEqual([
      'LANTERN Analyst',
      'LANTERN Communicator',
      'LANTERN Strategist',
      'LANTERN Thrive',
    ]);
    courseSettings.forEach((settings) => {
      expect(settings.organizationSettingsId).toBe(
        organizationChatbotSettings.id,
      );
      expect(settings.llmId).toBe(defaultModel.id);
      expect(settings.usingDefaultModel).toBe(true);
      expect(settings.usingDefaultPrompt).toBe(false);
      expect(settings.prompt).toContain(
        `You are LANTERN ${settings.course.chatbotAgentName}`,
      );
    });
  });
});
