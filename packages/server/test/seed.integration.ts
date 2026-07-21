import { Role } from '@koh/common';
import { ChatbotModule } from '../../server/src/chatbot/chatbot.module';
import { CourseModel } from '../../server/src/course/course.entity';
import { CourseSettingsModel } from '../../server/src/course/course_settings.entity';
import { OrganizationCourseModel } from '../../server/src/organization/organization-course.entity';
import { OrganizationModel } from '../../server/src/organization/organization.entity';
import { SemesterModel } from '../../server/src/semester/semester.entity';
import { QuestionModel } from '../../server/src/question/question.entity';
import { UserCourseModel } from '../../server/src/profile/user-course.entity';
import { SeedChatbotAgentGroupCommand } from '../../server/src/seed/seed-chatbot-agent-group.command';
import { SeedModule } from '../../server/src/seed/seed.module';
import {
  CourseFactory,
  OrganizationUserFactory,
  QuestionFactory,
  QueueFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { In } from 'typeorm';

describe('Seed Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    SeedModule,
    undefined,
    [ChatbotModule],
  );

  const createLanternPrerequisites = async () => {
    const organization = await OrganizationModel.create({
      name: 'UBC',
    }).save();
    const semester = await SemesterModel.create({
      name: '2026S Both Terms',
      organizationId: organization.id,
    }).save();
    const parentCourse = await CourseModel.create({
      name: 'LANTERN',
      semesterId: semester.id,
      enabled: true,
      sectionGroupName: '001',
      timezone: 'America/Los_Angeles',
    }).save();
    await OrganizationCourseModel.create({
      courseId: parentCourse.id,
      organizationId: organization.id,
    }).save();

    const professor = await UserFactory.create({
      email: 'lantern-professor@ubc.ca',
    });
    const student = await UserFactory.create({
      email: 'lantern-student@ubc.ca',
    });
    await OrganizationUserFactory.create({
      organization,
      organizationUser: professor,
    });
    await OrganizationUserFactory.create({
      organization,
      organizationUser: student,
    });
    await UserCourseFactory.create({
      user: professor,
      course: parentCourse,
      role: Role.PROFESSOR,
    });
    await UserCourseFactory.create({
      user: student,
      course: parentCourse,
      role: Role.STUDENT,
    });

    return { organization, parentCourse, professor, student };
  };

  const runLanternSeed = async () => {
    await getTestModule()
      .get(SeedChatbotAgentGroupCommand)
      .createLanternAgentGroup();
  };

  const getAgentCourses = async () =>
    CourseModel.find({
      where: {
        name: In([
          'LANTERN Analyst',
          'LANTERN Communicator',
          'LANTERN Strategist',
          'LANTERN Thrive',
        ]),
      },
      order: { chatbotAgentOrder: 'ASC' },
    });

  const getAgentCourseMembershipsFor = async (
    userId: number,
    agentCourseIds: number[],
  ): Promise<UserCourseModel[]> =>
    UserCourseModel.find({
      where: {
        userId,
        courseId: In(agentCourseIds),
      },
    });

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

  it('adds parent professors to agent courses and excludes students', async () => {
    const { professor, student } = await createLanternPrerequisites();

    await runLanternSeed();

    const agentCourses = await getAgentCourses();
    const agentCourseIds = agentCourses.map((course) => course.id);
    const professorMemberships = await getAgentCourseMembershipsFor(
      professor.id,
      agentCourseIds,
    );
    const studentMemberships = await getAgentCourseMembershipsFor(
      student.id,
      agentCourseIds,
    );

    expect(agentCourses).toHaveLength(4);
    expect(professorMemberships).toHaveLength(4);
    expect(
      professorMemberships.every(({ role }) => role === Role.PROFESSOR),
    ).toBe(true);
    expect(professorMemberships.every(({ favourited }) => favourited)).toBe(
      true,
    );
    expect(studentMemberships).toHaveLength(0);

    await supertest({ userId: professor.id })
      .get(`/chatbot/course/${agentCourses[0].id}/service`)
      .expect(200);
    await supertest({ userId: student.id })
      .get(`/chatbot/course/${agentCourses[0].id}/service`)
      .expect(403);
  });

  it('is idempotent and preserves existing agent membership roles', async () => {
    const { organization, parentCourse, professor } =
      await createLanternPrerequisites();
    const existingAgentCourse = await CourseModel.create({
      name: 'LANTERN Analyst',
      semesterId: parentCourse.semesterId,
      enabled: true,
      sectionGroupName: '001',
      timezone: 'America/Los_Angeles',
    }).save();
    await OrganizationCourseModel.create({
      courseId: existingAgentCourse.id,
      organizationId: organization.id,
    }).save();
    const existingMembership = await UserCourseModel.create({
      userId: professor.id,
      courseId: existingAgentCourse.id,
      role: Role.TA,
      favourited: false,
    }).save();

    await runLanternSeed();
    await runLanternSeed();

    const memberships = await getAgentCourseMembershipsFor(
      professor.id,
      (await getAgentCourses()).map((course) => course.id),
    );

    expect(memberships).toHaveLength(4);
    expect(
      memberships.find(({ id }) => id === existingMembership.id),
    ).toMatchObject({ role: Role.TA, favourited: false });
    expect(
      memberships.filter(({ role }) => role === Role.PROFESSOR),
    ).toHaveLength(3);
  });

  it('serializes concurrent invocations so no duplicate courses or memberships result', async () => {
    const { professor } = await createLanternPrerequisites();

    await Promise.all([
      runLanternSeed(),
      runLanternSeed(),
      runLanternSeed(),
      runLanternSeed(),
      runLanternSeed(),
    ]);

    const agentCourses = await getAgentCourses();
    expect(agentCourses).toHaveLength(4);

    const memberships = await getAgentCourseMembershipsFor(
      professor.id,
      agentCourses.map((course) => course.id),
    );
    expect(memberships).toHaveLength(4);
    expect(memberships.every(({ role }) => role === Role.PROFESSOR)).toBe(true);
  }, 30000);

  it('preserves existing agent course settings instead of re-enabling a disabled chatbot', async () => {
    const { organization, parentCourse } = await createLanternPrerequisites();
    const existingAgentCourse = await CourseModel.create({
      name: 'LANTERN Analyst',
      semesterId: parentCourse.semesterId,
      enabled: true,
      sectionGroupName: '001',
      timezone: 'America/Los_Angeles',
    }).save();
    await OrganizationCourseModel.create({
      courseId: existingAgentCourse.id,
      organizationId: organization.id,
    }).save();
    await CourseSettingsModel.create({
      courseId: existingAgentCourse.id,
      chatBotEnabled: false,
      asyncQueueEnabled: false,
      adsEnabled: false,
      queueEnabled: false,
    }).save();

    await runLanternSeed();

    const settings = await CourseSettingsModel.findOne({
      where: { courseId: existingAgentCourse.id },
    });
    expect(settings?.chatBotEnabled).toBe(false);
    expect(settings?.asyncQueueEnabled).toBe(false);
    expect(settings?.queueEnabled).toBe(false);
  });
});
