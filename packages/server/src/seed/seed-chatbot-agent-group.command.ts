import { SuperCoursePurpose } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { CourseModel } from 'course/course.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { SuperCourseModel } from 'course/super-course.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { SemesterModel } from 'semester/semester.entity';
import * as crypto from 'crypto';

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
const parentCourseName = 'LANTERN';
const organizationName = 'UBC';
const localFallbackOrganizationName = 'UBCO';
const semesterName = '2026S Both Terms';
const localFallbackSemesterName = 'Test Semester';

@Injectable()
export class SeedChatbotAgentGroupCommand {
  @Command({
    command: 'seed:chatbot-agent-group',
    describe: 'creates the LANTERN chatbot agent group demo courses',
  })
  async createLanternAgentGroup(): Promise<void> {
    const organization =
      (await OrganizationModel.findOne({
        where: { name: organizationName },
      })) ??
      (await OrganizationModel.findOneOrFail({
        where: { name: localFallbackOrganizationName },
      }));
    const semester =
      (await SemesterModel.findOne({
        where: { name: semesterName, organizationId: organization.id },
      })) ??
      (await SemesterModel.findOne({
        where: {
          name: localFallbackSemesterName,
          organizationId: organization.id,
        },
      })) ??
      (await SemesterModel.findOne({
        where: { organizationId: organization.id },
      }));
    const superCourse = await this.findOrCreateSuperCourse(organization.id);
    const parentCourse = await this.findOrCreateCourse(
      parentCourseName,
      semester?.id,
    );

    await this.attachCourseToGroup(parentCourse, superCourse, organization.id);

    for (const [index, agent] of agents.entries()) {
      const course = await this.findOrCreateCourse(
        this.getAgentCourseName(agent.name),
        semester?.id,
      );
      course.chatbotAgentName = agent.name;
      course.chatbotAgentDescription = agent.description;
      course.chatbotAgentOrder = index + 1;
      await this.attachCourseToGroup(course, superCourse, organization.id);
    }

    console.log(
      `Seeded LANTERN chatbot agent group ${superCourse.id} with parent course ${parentCourse.id}`,
    );
  }

  private getAgentCourseName(agentName: string): string {
    return `${parentCourseName} ${agentName}`;
  }

  private async findOrCreateSuperCourse(
    organizationId: number,
  ): Promise<SuperCourseModel> {
    const existing = await SuperCourseModel.findOne({
      where: {
        name: 'LANTERN Agents',
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
      },
      relations: { courses: true },
    });
    if (existing) {
      return existing;
    }

    return SuperCourseModel.create({
      name: 'LANTERN Agents',
      organizationId,
      purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
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
      zoomLink: '',
      enabled: true,
      courseInviteCode: crypto.randomBytes(6).toString('hex'),
    }).save();
  }

  private async attachCourseToGroup(
    course: CourseModel,
    superCourse: SuperCourseModel,
    organizationId: number,
  ): Promise<void> {
    if (course.name === parentCourseName) {
      course.chatbotAgentName = null;
      course.chatbotAgentDescription = null;
      course.chatbotAgentOrder = null;
    }
    await course.save();
    superCourse.courses = superCourse.courses ?? [];
    if (
      !superCourse.courses.some((groupCourse) => groupCourse.id === course.id)
    ) {
      superCourse.courses.push(course);
      await superCourse.save();
    }

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
}
