import {
  MailServiceType,
  OrganizationRole,
  QueueConfig,
  Role,
} from '@koh/common';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AlertModel } from 'alerts/alerts.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { LastRegistrationModel } from 'login/last-registration-model.entity';
import { DesktopNotifModel } from 'notification/desktop-notif.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { UserModel } from 'profile/user.entity';
import { QuestionGroupModel } from 'question/question-group.entity';
import { SemesterModel } from 'semester/semester.entity';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { OrganizationModel } from 'organization/organization.entity';
import { getManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  CourseFactory,
  EventFactory,
  QuestionFactory,
  QueueFactory,
  SemesterFactory,
  UserCourseFactory,
  UserFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  OrganizationCourseFactory,
  CourseSettingsFactory,
  QuestionTypeFactory,
  ChatTokenFactory,
  mailServiceFactory,
  userSubscriptionFactory,
} from '../../test/util/factories';
import { CourseModel } from '../course/course.entity';
import { NonProductionGuard } from '../guards/non-production.guard';
import { QuestionModel } from '../question/question.entity';
import { QueueModel } from '../queue/queue.entity';
import { SeedService } from './seed.service';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { InteractionModel } from 'chatbot/interaction.entity';
import { ChatbotQuestionModel } from 'chatbot/question.entity';
import { ChatTokenModel } from 'chatbot/chat-token.entity';
import { MailServiceModel } from 'mail/mail-services.entity';
import { UserSubscriptionModel } from 'mail/user-subscriptions.entity';
import { UserTokenModel } from 'profile/user-token.entity';
import { InsightDashboardModel } from '../insights/dashboard.entity';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { LMSAssignmentModel } from '../lmsIntegration/lmsAssignment.entity';
import { CalendarModel } from '../calendar/calendar.entity';
import { LMSAnnouncementModel } from 'lmsIntegration/lmsAnnouncement.entity';
import { UnreadAsyncQuestionModel } from 'asyncQuestion/unread-async-question.entity';
import { QueueChatsModel } from 'queueChats/queue-chats.entity';

const exampleConfig = {
  fifo_queue_view_enabled: true,
  tag_groups_queue_view_enabled: true,
  default_view: 'fifo',
  minimum_tags: 0,
  tags: {
    tag1: {
      display_name: 'General',
      color_hex: '#66FF66',
    },
    tag2: {
      display_name: 'Bugs',
      color_hex: '#66AA66',
    },
    tag3: {
      display_name: 'Important',
      color_hex: '#FF0000',
    },
  },
};

const exampleLabConfig = {
  fifo_queue_view_enabled: true,
  tag_groups_queue_view_enabled: true,
  default_view: 'fifo',
  minimum_tags: 1,
  tags: {
    tag1: {
      display_name: 'General',
      color_hex: '#66FF66',
    },
    tag2: {
      display_name: 'Bugs',
      color_hex: '#66AA66',
    },
    tag3: {
      display_name: 'Important',
      color_hex: '#FF0000',
    },
  },
  assignment_id: 'lab1',
  tasks: {
    task1: {
      display_name: 'Task 1',
      short_display_name: '1',
      blocking: false,
      color_hex: '#ffedb8',
      precondition: null,
    },
    task2: {
      display_name: 'Task 2',
      short_display_name: '2',
      blocking: false,
      color_hex: '#fadf8e',
      precondition: 'task1',
    },
    task3: {
      display_name: 'Task 3',
      short_display_name: '3',
      blocking: true,
      color_hex: '#f7ce52',
      precondition: 'task2',
    },
    task4: {
      display_name: 'Task 4',
      short_display_name: '4',
      blocking: false,
      color_hex: '#ffce52',
      precondition: 'task3',
    },
  },
};

@UseGuards(NonProductionGuard)
@Controller('seeds')
export class SeedController {
  constructor(private seedService: SeedService) {}

  @Get('delete')
  async deleteAll(): Promise<string> {
    // NOTE: order of deletion matters for tables with foreign keys.
    // Children tables should be removed as early as possible.
    await this.seedService.deleteAll(QueueChatsModel);
    await this.seedService.deleteAll(UnreadAsyncQuestionModel);
    await this.seedService.deleteAll(LMSAssignmentModel);
    await this.seedService.deleteAll(LMSAnnouncementModel);
    await this.seedService.deleteAll(LMSCourseIntegrationModel);
    await this.seedService.deleteAll(LMSOrganizationIntegrationModel);
    await this.seedService.deleteAll(InsightDashboardModel);
    await this.seedService.deleteAll(CalendarModel);
    await this.seedService.deleteAll(QuestionTypeModel);
    await this.seedService.deleteAll(OrganizationCourseModel);
    await this.seedService.deleteAll(UserSubscriptionModel);
    await this.seedService.deleteAll(OrganizationUserModel);
    await this.seedService.deleteAll(LastRegistrationModel);
    await this.seedService.deleteAll(QuestionModel);
    await this.seedService.deleteAll(AsyncQuestionModel);
    await this.seedService.deleteAll(QuestionGroupModel);
    await this.seedService.deleteAll(QueueModel);
    await this.seedService.deleteAll(UserCourseModel);
    await this.seedService.deleteAll(EventModel);
    await this.seedService.deleteAll(DesktopNotifModel);
    await this.seedService.deleteAll(AlertModel);
    await this.seedService.deleteAll(ChatbotQuestionModel);
    await this.seedService.deleteAll(InteractionModel);
    await this.seedService.deleteAll(ChatTokenModel);
    await this.seedService.deleteAll(UserTokenModel);
    await this.seedService.deleteAll(UserModel);
    await this.seedService.deleteAll(CourseSectionMappingModel);
    await this.seedService.deleteAll(CourseModel);
    await this.seedService.deleteAll(SemesterModel);
    await this.seedService.deleteAll(OrganizationModel);
    await this.seedService.deleteAll(QuestionTypeModel);
    await this.seedService.deleteAll(CourseSettingsModel);
    await this.seedService.deleteAll(MailServiceModel);
    const manager = getManager();
    manager.query('ALTER SEQUENCE user_model_id_seq RESTART WITH 1;');
    manager.query('ALTER SEQUENCE organization_model_id_seq RESTART WITH 1;');

    return 'Data successfully reset';
  }

  @Get('create')
  async createSeeds(): Promise<string> {
    // First delete the old data
    await this.deleteAll();

    // Then add the new seed data
    const salt = await bcrypt.genSalt(10);
    const hashedPassword1 = await bcrypt.hash('seed', salt);
    const now = new Date();

    const yesterday = new Date();
    yesterday.setUTCHours(now.getUTCHours() - 24);

    const tomorrow = new Date();
    tomorrow.setUTCHours(now.getUTCHours() + 19);

    const facultyMailService = await mailServiceFactory.create({
      mailType: OrganizationRole.PROFESSOR,
      serviceType: MailServiceType.ASYNC_QUESTION_FLAGGED,
      name: 'Notify when a new anytime question is flagged as needing attention',
    });
    const studentMailService = await mailServiceFactory.create({
      mailType: OrganizationRole.MEMBER,
      serviceType: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED,
      name: 'Notify when your anytime question has been answered by faculty',
    });

    const studentMailService2 = await mailServiceFactory.create({
      mailType: OrganizationRole.MEMBER,
      serviceType: MailServiceType.ASYNC_QUESTION_STATUS_CHANGED,
      name: 'Notify when the status of your anytime question has changed',
    });

    const studentMailService3 = await mailServiceFactory.create({
      mailType: OrganizationRole.MEMBER,
      serviceType: MailServiceType.ASYNC_QUESTION_UPVOTED,
      name: 'Notify when your anytime question has been upvoted',
    });
    const studentMailService4 = await mailServiceFactory.create({
      mailType: OrganizationRole.MEMBER,
      serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_MY_POST,
      name: 'Notify when someone comments on your anytime question',
    });
    const studentMailService5 = await mailServiceFactory.create({
      mailType: OrganizationRole.MEMBER,
      serviceType: MailServiceType.ASYNC_QUESTION_NEW_COMMENT_ON_OTHERS_POST,
      name: 'Notify when someone comments on an anytime question you commented on',
    });
    const course1Exists = await CourseModel.findOne({
      where: { name: 'CS 304' },
    });

    const course2Exists = await CourseModel.findOne({
      where: { name: 'CS 310' },
    });

    const organization = await OrganizationFactory.create({
      name: 'UBCO',
      description: 'UBC Okanagan',
      legacyAuthEnabled: true,
    });

    const semester1 = await SemesterFactory.create({
      organization: organization,
      startDate: new Date('2020-09-01'),
      endDate: new Date('2020-12-31'),
      name: 'Fall 2020',
    });

    const semester2 = await SemesterFactory.create({
      organization: organization,
      startDate: new Date('2020-05-01'),
      endDate: new Date('2020-08-31'),
      name: 'Summer 2020',
    });

    if (!course1Exists) {
      // possible collision:
      // If the dev env is active at midnight, the cron job will rescrape events from the ical which
      // synthetically creates events centered around your time.
      // But since the semester is centered in Fall 2020,
      // the events will get filtered out since they arent in that date.
      // you will need to reseed data!

      // comments above are from legacy implementation

      await CourseFactory.create({
        timezone: 'America/Los_Angeles',
        semester: semester1,
      });
    }

    if (!course2Exists) {
      await CourseFactory.create({
        name: 'CS 310',
        timezone: 'America/Los_Angeles',
        semester: semester2,
      });
    }

    const course1 = await CourseModel.findOne({
      where: { name: 'CS 304' },
    });

    const course2 = await CourseModel.findOne({
      where: { name: 'CS 310' },
    });

    await CourseSettingsFactory.create({
      course: course1,
      courseId: course1.id,
      chatBotEnabled: true,
      asyncQueueEnabled: true,
      adsEnabled: true,
      queueEnabled: true,
    });
    await CourseSettingsFactory.create({
      course: course2,
      courseId: course2.id,
      chatBotEnabled: true,
      asyncQueueEnabled: true,
      adsEnabled: true,
      queueEnabled: true,
    });

    const userExists = await UserModel.findOne();

    if (!userExists) {
      // Student 1
      const user1 = await UserFactory.create({
        email: 'studentOne@ubc.ca',
        firstName: 'studentOne',
        lastName: 'studentOne',
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user1,
        used: 0,
        max_uses: 20,
        token: 'test_token',
      });

      await UserCourseFactory.create({
        user: user1,
        role: Role.STUDENT,
        course: course1,
      });
      await UserCourseFactory.create({
        user: user1,
        role: Role.STUDENT,
        course: course2,
      });
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user1,
        service: studentMailService,
      });
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user1,
        service: studentMailService2,
      });
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user1,
        service: studentMailService3,
      });
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user1,
        service: studentMailService4,
      });
      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user1,
        service: studentMailService5,
      });

      // Student 2
      const user2 = await UserFactory.create({
        email: 'studentTwo@ubc.ca',
        firstName: 'studentTwo',
        lastName: 'studentTwo',
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user2,
        used: 0,
        max_uses: 20,
        token: 'test_token2',
      });

      await UserCourseFactory.create({
        user: user2,
        role: Role.STUDENT,
        course: course1,
      });

      await UserCourseFactory.create({
        user: user2,
        role: Role.STUDENT,
        course: course2,
      });

      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user2,
        service: studentMailService,
      });
      // TA 1
      const user3 = await UserFactory.create({
        email: 'TaOne@ubc.ca',
        firstName: 'TaOne',
        lastName: 'TaOne',
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user3,
        used: 0,
        max_uses: 20,
        token: 'test_token3',
      });

      await UserCourseFactory.create({
        user: user3,
        role: Role.TA,
        course: course1,
      });
      await UserCourseFactory.create({
        user: user3,
        role: Role.TA,
        course: course2,
      });

      // TA 2
      const user4 = await UserFactory.create({
        email: 'TaTwo@ubc.ca',
        firstName: 'TaTwo',
        lastName: 'TaTwo',
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user4,
        used: 0,
        max_uses: 20,
        token: 'test_token4',
      });

      await UserCourseFactory.create({
        user: user4,
        role: Role.TA,
        course: course1,
      });

      await UserCourseFactory.create({
        user: user4,
        role: Role.TA,
        course: course2,
      });

      // Professor for COSC 304
      const user5 = await UserFactory.create({
        email: 'Ramon@ubc.ca',
        firstName: 'Ramon',
        lastName: 'Lawrence',
        insights: [
          'QuestionTypeBreakdown',
          'TotalQuestionsAsked',
          'TotalStudents',
        ],
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user5,
        used: 0,
        max_uses: 20,
        token: 'test_token5',
      });

      await UserCourseFactory.create({
        user: user5,
        role: Role.PROFESSOR,
        course: course1,
      });

      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user5,
        service: facultyMailService,
      });

      // Professor for COSC 310
      const user6 = await UserFactory.create({
        email: 'orgProfessor@ubc.ca',
        firstName: 'Organization',
        lastName: 'Professor',
        insights: [
          'QuestionTypeBreakdown',
          'TotalQuestionsAsked',
          'TotalStudents',
        ],
        password: hashedPassword1,
        emailVerified: true,
      });

      await ChatTokenFactory.create({
        user: user6,
        used: 0,
        max_uses: 20,
        token: 'test_token6',
      });

      await UserCourseFactory.create({
        user: user6,
        role: Role.PROFESSOR,
        course: course2,
      });

      await userSubscriptionFactory.create({
        isSubscribed: true,
        user: user6,
        service: facultyMailService,
      });

      await OrganizationUserFactory.create({
        userId: user1.id,
        organizationId: organization.id,
        organizationUser: user1,
        organization: organization,
      });

      await OrganizationUserFactory.create({
        userId: user2.id,
        organizationId: organization.id,
        organizationUser: user2,
        organization: organization,
      });

      await OrganizationUserFactory.create({
        userId: user3.id,
        organizationId: organization.id,
        organizationUser: user3,
        organization: organization,
      });

      await OrganizationUserFactory.create({
        userId: user4.id,
        organizationId: organization.id,
        organizationUser: user4,
        organization: organization,
      });

      await OrganizationUserFactory.create({
        userId: user5.id,
        organizationId: organization.id,
        role: OrganizationRole.ADMIN,
        organizationUser: user5,
        organization: organization,
      });

      await OrganizationUserFactory.create({
        userId: user6.id,
        organizationId: organization.id,
        role: OrganizationRole.PROFESSOR,
        organizationUser: user6,
        organization: organization,
      });

      await OrganizationCourseFactory.create({
        organizationId: organization.id,
        courseId: course1.id,
        organization: organization,
        course: course1,
      });
    }

    const queue1 = await QueueFactory.create({
      room: 'Online',
      config: exampleConfig as QueueConfig,
      course: course1,
      allowQuestions: true,
    });

    const queue2 = await QueueFactory.create({
      room: 'Online',
      config: exampleConfig as QueueConfig,
      course: course2,
      allowQuestions: true,
    });

    const questionType1 = await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queue1,
    });

    const questionType3 = await QuestionTypeFactory.create({
      cid: course2.id,
      queue: queue2,
    });

    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queue1,
      name: 'General',
      color: '#66FF66',
    });
    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queue1,
      name: 'Bugs',
      color: '#66AA66',
    });
    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queue1,
      name: 'Important',
      color: '#FF0000',
    });

    await QuestionFactory.create({
      queue: queue1,
      createdAt: new Date(Date.now() - 3500000),
      questionTypes: [questionType1],
    });

    await QuestionFactory.create({
      queue: queue1,
      createdAt: new Date(Date.now() - 2500000),
      questionTypes: [questionType1],
    });

    await QuestionFactory.create({
      queue: queue1,
      createdAt: new Date(Date.now() - 1500000),
      questionTypes: [questionType1],
    });

    const queueLab = await QueueFactory.create({
      room: 'Example Lab Room',
      course: course1,
      allowQuestions: true,
      config: exampleLabConfig as QueueConfig,
    });

    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queueLab,
      name: 'General',
      color: '#66FF66',
    });
    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queueLab,
      name: 'Bugs',
      color: '#66AA66',
    });
    await QuestionTypeFactory.create({
      cid: course1.id,
      queue: queueLab,
      name: 'Important',
      color: '#FF0000',
    });

    const eventTA = await UserModel.findOne({
      where: {
        firstName: 'TaOne',
      },
    });

    await EventFactory.create({
      user: eventTA,
      course: course1,
      time: yesterday,
      eventType: EventType.TA_CHECKED_IN,
    });

    await EventFactory.create({
      user: eventTA,
      course: course1,
      time: new Date(Date.now() - 80000000),
      eventType: EventType.TA_CHECKED_OUT,
    });

    await EventFactory.create({
      user: eventTA,
      course: course1,
      time: new Date(Date.now() - 70000000),
      eventType: EventType.TA_CHECKED_IN,
    });

    const todayAtMidnight = new Date();
    todayAtMidnight.setHours(0, 0, 0, 0);

    await EventFactory.create({
      user: eventTA,
      course: course1,
      time: todayAtMidnight,
      eventType: EventType.TA_CHECKED_OUT_FORCED,
    });

    const professorQueue = await QueueFactory.create({
      room: "Professor Lawrence's Hours",
      course: course1,
      allowQuestions: true,
      isProfessorQueue: true,
    });

    const questionType2 = await QuestionTypeFactory.create({
      cid: course1.id,
      queue: professorQueue,
      name: 'Important',
      color: '#FF0000',
    });

    await QuestionFactory.create({
      queue: queueLab,
      createdAt: new Date(Date.now() - 1500000),
      questionTypes: [questionType2],
    });

    return 'Data successfully seeded';
  }

  @Get('fill_queue')
  async fillQueue(): Promise<string> {
    const queue = await QueueModel.findOne();

    const questionType = await QuestionTypeFactory.create({
      cid: queue.course.id,
      queue: queue,
    });

    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
      questionTypes: [questionType],
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
      questionTypes: [questionType],
    });
    await QuestionFactory.create({
      queue: queue,
      createdAt: new Date(Date.now() - 1500000),
      questionTypes: [questionType],
    });

    return 'Data successfully seeded';
  }
}
