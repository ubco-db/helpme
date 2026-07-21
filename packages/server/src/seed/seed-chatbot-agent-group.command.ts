import { Role, SuperCoursePurpose } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Command } from 'nestjs-command';
import { CourseModel } from 'course/course.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { SuperCourseModel } from 'course/super-course.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { SemesterModel } from 'semester/semester.entity';
import * as crypto from 'crypto';
import { DataSource, EntityManager, In } from 'typeorm';

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
const semesterName = '2026S Both Terms';
const SEED_CHATBOT_AGENT_GROUP_LOCK_KEY = 4_242_424_242_424_242;

@Injectable()
export class SeedChatbotAgentGroupCommand {
  constructor(private dataSource: DataSource) {}

  @Command({
    command: 'seed:chatbot-agent-group',
    describe: 'creates the LANTERN chatbot agent group demo courses',
  })
  async createLanternAgentGroup(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        SEED_CHATBOT_AGENT_GROUP_LOCK_KEY,
      ]);

      const organization = await manager.findOneOrFail(OrganizationModel, {
        where: { name: organizationName },
      });
      const semester = await manager.findOneOrFail(SemesterModel, {
        where: { name: semesterName, organizationId: organization.id },
      });
      const superCourse = await this.findOrCreateSuperCourse(
        manager,
        organization.id,
      );
      const parentCourse = await this.findOrCreateCourse(
        manager,
        parentCourseName,
        semester.id,
        organization.id,
      );

      await this.attachCourseToGroup(
        manager,
        parentCourse,
        superCourse,
        organization.id,
      );

      const parentCourseProfessorMemberships = await manager.find(
        UserCourseModel,
        {
          where: {
            courseId: parentCourse.id,
            role: Role.PROFESSOR,
          },
        },
      );

      for (const [index, agent] of agents.entries()) {
        const agentCourse = await this.findOrCreateCourse(
          manager,
          this.getAgentCourseName(agent.name),
          semester.id,
          organization.id,
        );
        agentCourse.chatbotAgentName = agent.name;
        agentCourse.chatbotAgentDescription = agent.description;
        agentCourse.chatbotAgentOrder = index + 1;
        await this.attachCourseToGroup(
          manager,
          agentCourse,
          superCourse,
          organization.id,
        );
        await this.addMissingProfessorMemberships(
          manager,
          agentCourse.id,
          parentCourseProfessorMemberships,
        );
      }

      console.log(
        `Seeded LANTERN chatbot agent group ${superCourse.id} with parent course ${parentCourse.id}`,
      );
    });
  }

  private getAgentCourseName(agentName: string): string {
    return `${parentCourseName} ${agentName}`;
  }

  private async addMissingProfessorMemberships(
    manager: EntityManager,
    agentCourseId: number,
    parentCourseProfessorMemberships: UserCourseModel[],
  ): Promise<void> {
    const professorIds = Array.from(
      new Set(
        parentCourseProfessorMemberships
          .map((userCourse) => userCourse.userId)
          .filter((userId): userId is number => userId !== null),
      ),
    );
    if (professorIds.length === 0) {
      return;
    }

    const existingMemberships = await manager.find(UserCourseModel, {
      where: {
        courseId: agentCourseId,
        userId: In(professorIds),
      },
    });
    const existingUserIds = new Set(
      existingMemberships.map((userCourse) => userCourse.userId),
    );
    const missingMemberships = professorIds
      .filter((userId) => !existingUserIds.has(userId))
      .map((userId) =>
        manager.create(UserCourseModel, {
          userId,
          courseId: agentCourseId,
          role: Role.PROFESSOR,
        }),
      );

    if (missingMemberships.length > 0) {
      await manager.save(UserCourseModel, missingMemberships);
    }
  }

  private async findOrCreateSuperCourse(
    manager: EntityManager,
    organizationId: number,
  ): Promise<SuperCourseModel> {
    const existing = await manager.findOne(SuperCourseModel, {
      where: {
        name: 'LANTERN Agents',
        organizationId,
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
      },
      relations: { courses: true },
    });
    if (existing) {
      return existing;
    }

    return manager.save(
      SuperCourseModel,
      manager.create(SuperCourseModel, {
        name: 'LANTERN Agents',
        organizationId,
        purpose: SuperCoursePurpose.CHATBOT_AGENT_GROUP,
        courses: [],
      }),
    );
  }

  private async findOrCreateCourse(
    manager: EntityManager,
    name: string,
    semesterId: number,
    organizationId: number,
  ): Promise<CourseModel> {
    const existing = await manager
      .createQueryBuilder(CourseModel, 'course')
      .innerJoin(
        OrganizationCourseModel,
        'organizationCourse',
        '"organizationCourse"."courseId" = course.id',
      )
      .where('course.name = :name', { name })
      .andWhere('course.semesterId = :semesterId', { semesterId })
      .andWhere('"organizationCourse"."organizationId" = :organizationId', {
        organizationId,
      })
      .getOne();
    if (existing) {
      return existing;
    }

    return manager.save(
      CourseModel,
      manager.create(CourseModel, {
        name,
        semesterId,
        timezone: 'America/Los_Angeles',
        sectionGroupName: '001',
        zoomLink: '',
        enabled: true,
        courseInviteCode: crypto.randomBytes(6).toString('hex'),
      }),
    );
  }

  private async attachCourseToGroup(
    manager: EntityManager,
    course: CourseModel,
    superCourse: SuperCourseModel,
    organizationId: number,
  ): Promise<void> {
    if (course.name === parentCourseName) {
      course.chatbotAgentName = null;
      course.chatbotAgentDescription = null;
      course.chatbotAgentOrder = null;
    }
    await manager.save(CourseModel, course);
    superCourse.courses = superCourse.courses ?? [];
    if (
      !superCourse.courses.some((groupCourse) => groupCourse.id === course.id)
    ) {
      superCourse.courses.push(course);
      await manager.save(SuperCourseModel, superCourse);
    }

    if (
      !(await manager.findOne(OrganizationCourseModel, {
        where: { courseId: course.id, organizationId },
      }))
    ) {
      await manager.save(
        OrganizationCourseModel,
        manager.create(OrganizationCourseModel, {
          courseId: course.id,
          organizationId,
        }),
      );
    }

    if (
      !(await manager.findOne(CourseSettingsModel, {
        where: { courseId: course.id },
      }))
    ) {
      await manager.save(
        CourseSettingsModel,
        manager.create(CourseSettingsModel, {
          courseId: course.id,
          chatBotEnabled: true,
          asyncQueueEnabled: true,
          adsEnabled: true,
          queueEnabled: true,
        }),
      );
    }
  }
}
