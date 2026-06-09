import { Role } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { CourseModel } from 'course/course.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { SuperCourseModel } from 'course/super-course.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { SemesterModel } from 'semester/semester.entity';

const agents = [
  {
    name: 'Analyst',
    description:
      'Research foundations, statistics, research methods, terminology, philosophy of science, and critical appraisal.',
  },
  {
    name: 'Communicator',
    description:
      'Scholarly communication, literature synthesis, scientific writing, and oral presentations.',
  },
  {
    name: 'Strategist',
    description:
      'Grantsmanship, funder alignment, grant structure, budget justification, project management, and reviewer perspective.',
  },
  {
    name: 'Thrive',
    description:
      'Academic culture, hidden curriculum, mentorship navigation, common challenges in academia, and career planning.',
  },
];

@Injectable()
export class SeedChatbotAgentGroupCommand {
  @Command({
    command: 'seed:chatbot-agent-group',
    describe: 'creates the LANTERN chatbot agent group demo courses',
  })
  async createLanternAgentGroup(): Promise<void> {
    const organization = await OrganizationModel.findOneOrFail({
      where: { name: 'UBCO' },
    });
    const semester =
      (await SemesterModel.findOne({ where: { name: 'Test Semester' } })) ??
      (await SemesterModel.findOne({
        where: { organizationId: organization.id },
      }));
    const superCourse = await this.findOrCreateSuperCourse(organization.id);
    const parentCourse = await this.findOrCreateCourse('LANTERN', semester?.id);

    await this.attachCourseToGroup(parentCourse, superCourse, organization.id);
    await this.enrollStudentOne(parentCourse);

    for (const [index, agent] of agents.entries()) {
      const course = await this.findOrCreateCourse(agent.name, semester?.id);
      course.chatbotAgentName = agent.name;
      course.chatbotAgentDescription = agent.description;
      course.chatbotAgentOrder = index + 1;
      await this.attachCourseToGroup(course, superCourse, organization.id);
    }

    console.log(
      `Seeded LANTERN chatbot agent group ${superCourse.id} with parent course ${parentCourse.id}`,
    );
  }

  private async findOrCreateSuperCourse(
    organizationId: number,
  ): Promise<SuperCourseModel> {
    const existing = await SuperCourseModel.findOne({
      where: { name: 'LANTERN Agents', purpose: 'chatbot_agent_group' },
    });
    if (existing) {
      return existing;
    }

    return SuperCourseModel.create({
      name: 'LANTERN Agents',
      organizationId,
      purpose: 'chatbot_agent_group',
    }).save();
  }

  private async findOrCreateCourse(
    name: string,
    semesterId?: number,
  ): Promise<CourseModel> {
    const existing = await CourseModel.findOne({ where: { name } });
    if (existing) {
      return existing;
    }

    return CourseModel.create({
      name,
      semesterId,
      timezone: 'America/Los_Angeles',
      sectionGroupName: '001',
      enabled: true,
    }).save();
  }

  private async attachCourseToGroup(
    course: CourseModel,
    superCourse: SuperCourseModel,
    organizationId: number,
  ): Promise<void> {
    course.superCourseId = superCourse.id;
    if (course.name === 'LANTERN') {
      course.chatbotAgentName = null;
      course.chatbotAgentDescription = null;
      course.chatbotAgentOrder = null;
    }
    await course.save();

    if (
      !(await OrganizationCourseModel.findOne({
        where: { courseId: course.id },
      }))
    ) {
      await OrganizationCourseModel.create({
        courseId: course.id,
        organizationId,
      }).save();
    }

    if (
      !(await CourseSettingsModel.findOne({ where: { courseId: course.id } }))
    ) {
      await CourseSettingsModel.create({
        courseId: course.id,
        chatBotEnabled: true,
        asyncQueueEnabled: true,
        adsEnabled: true,
        queueEnabled: true,
      }).save();
    }
  }

  private async enrollStudentOne(parentCourse: CourseModel): Promise<void> {
    const student = await UserModel.findOne({
      where: { email: 'studentOne@ubc.ca' },
    });
    if (!student) {
      return;
    }

    const existingEnrollment = await UserCourseModel.findOne({
      where: { userId: student.id, courseId: parentCourse.id },
    });
    if (!existingEnrollment) {
      await UserCourseModel.create({
        userId: student.id,
        courseId: parentCourse.id,
        role: Role.STUDENT,
      }).save();
    }
  }
}
