import { QuestionGroupModel } from 'question/question-group.entity';
import {
  AlertType,
  asyncQuestionStatus,
  calendarEventLocationType,
  LMSIntegrationPlatform,
  MailServiceType,
  OrganizationRole,
  Role,
} from '@koh/common';
import { AlertModel } from '../alerts/alerts.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { Factory } from 'typeorm-factory';
import { CourseModel } from '../course/course.entity';
import { SemesterModel } from '../semester/semester.entity';
import { CourseSectionMappingModel } from '../login/course-section-mapping.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { UserModel } from '../profile/user.entity';
import { QuestionModel } from '../question/question.entity';
import { QueueModel } from '../queue/queue.entity';
import { LastRegistrationModel } from 'login/last-registration-model.entity';
import { OrganizationModel } from '../organization/organization.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { OrganizationCourseModel } from '../organization/organization-course.entity';
import { QuestionTypeModel } from '../questionType/question-type.entity';
import { OrganizationUserModel } from '../organization/organization-user.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { AsyncQuestionVotesModel } from '../asyncQuestion/asyncQuestionVotes.entity';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { MailServiceModel } from '../mail/mail-services.entity';
import { UserSubscriptionModel } from '../mail/user-subscriptions.entity';
import { v4 } from 'uuid';
import { StudentTaskProgressModel } from '../studentTaskProgress/studentTaskProgress.entity';
import { CalendarModel } from '../calendar/calendar.entity';
import { QueueInviteModel } from '../queue/queue-invite.entity';
import { InsightDashboardModel } from '../insights/dashboard.entity';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { LMSAssignmentModel } from '../lmsIntegration/lmsAssignment.entity';
import { CalendarStaffModel } from '../calendar/calendar-staff.entity';
import { AsyncQuestionCommentModel } from '../asyncQuestion/asyncQuestionComment.entity';
import { QueueChatsModel } from '../queueChats/queue-chats.entity';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

/* Has all of our factories and initializes them with the db dataSource. 
  If you want to use one of these factories, import it from factories.ts instead.

  If you are creating a new factory, first create it here and then modify factories.ts so that it exports it.
  Also make sure your test file calls the initFactoriesFromService function otherwise you will not be able to use the factories from factories.ts!

  IMPORTANT: The order in which the factories are created is important.
  If a factory has a .assocOne() to another factory, it must be created after the other factory.
*/
@Injectable()
export class FactoryService {
  public UserFactory: Factory<UserModel>;
  public StudentCourseFactory: Factory<UserCourseModel>;
  public TACourseFactory: Factory<UserCourseModel>;
  public SemesterFactory: Factory<SemesterModel>;
  public CourseFactory: Factory<CourseModel>;
  public CourseSettingsFactory: Factory<CourseSettingsModel>;
  public CourseSectionFactory: Factory<CourseSectionMappingModel>;
  public UserCourseFactory: Factory<UserCourseModel>;
  public QueueFactory: Factory<QueueModel>;
  public QueueInviteFactory: Factory<QueueInviteModel>;
  public QuestionTypeFactory: Factory<QuestionTypeModel>;
  public QuestionFactory: Factory<QuestionModel>;
  public QuestionGroupFactory: Factory<QuestionGroupModel>;
  public EventFactory: Factory<EventModel>;
  public LastRegistrationFactory: Factory<LastRegistrationModel>;
  public AlertFactory: Factory<AlertModel>;
  public VotesFactory: Factory<AsyncQuestionVotesModel>;
  public AsyncQuestionFactory: Factory<AsyncQuestionModel>;
  public AsyncQuestionCommentFactory: Factory<AsyncQuestionCommentModel>;
  public OrganizationFactory: Factory<OrganizationModel>;
  public InteractionFactory: Factory<InteractionModel>;
  public OrganizationCourseFactory: Factory<OrganizationCourseModel>;
  public OrganizationUserFactory: Factory<OrganizationUserModel>;
  public ChatTokenFactory: Factory<ChatTokenModel>;
  public StudentTaskProgressFactory: Factory<StudentTaskProgressModel>;
  public mailServiceFactory: Factory<MailServiceModel>;
  public userSubscriptionFactory: Factory<UserSubscriptionModel>;
  public CalendarStaffFactory: Factory<CalendarStaffModel>;
  public calendarFactory: Factory<CalendarModel>;
  public dashboardPresetFactory: Factory<InsightDashboardModel>;
  public lmsOrgIntFactory: Factory<LMSOrganizationIntegrationModel>;
  public lmsCourseIntFactory: Factory<LMSCourseIntegrationModel>;
  public lmsAssignmentFactory: Factory<LMSAssignmentModel>;
  public queueChatsFactory: Factory<QueueChatsModel>;

  constructor(dataSource: DataSource) {
    this.UserFactory = new Factory(UserModel, dataSource)
      .attr('email', `user@ubc.ca`)
      .attr('firstName', 'User')
      .attr('lastName', 'Person')
      .attr('emailVerified', true)
      .attr('photoURL', 'https://example.com')
      .attr('hideInsights', []);

    this.StudentCourseFactory = new Factory(UserCourseModel, dataSource).attr(
      'role',
      Role.STUDENT,
    );

    this.TACourseFactory = new Factory(UserCourseModel, dataSource).attr(
      'role',
      Role.TA,
    );

    this.OrganizationFactory = new Factory(OrganizationModel, dataSource)
      .attr('name', 'UBCO')
      .attr('description', 'UBC Okanagan');

    this.SemesterFactory = new Factory(SemesterModel, dataSource)
      .attr('name', 'Test Semester')
      .attr('startDate', new Date('2020-09-01'))
      .attr('endDate', new Date('2022-12-31'))
      .attr('description', 'Test Semester Description')
      .assocOne('organization', this.OrganizationFactory);

    this.CourseFactory = new Factory(CourseModel, dataSource)
      .attr('name', 'CS 304')
      // calendar is owned by
      .attr(
        'icalURL',
        'https://calendar.google.com/calendar/ical/t6lu2pic7u9otrbpkuk26sl34g%40group.calendar.google.com/public/basic.ics',
      )
      .attr('sectionGroupName', '001')
      .attr('enabled', true)
      .attr('courseInviteCode', 'invite-code')
      .assocOne('semester', this.SemesterFactory);

    this.CourseSettingsFactory = new Factory(CourseSettingsModel, dataSource)
      .assocOne('course', this.CourseFactory)
      .attr('chatBotEnabled', true)
      .attr('asyncQueueEnabled', true)
      .attr('adsEnabled', true)
      .attr('queueEnabled', true);

    this.CourseSectionFactory = new Factory(
      CourseSectionMappingModel,
      dataSource,
    )
      .attr('crn', 12345)
      .assocOne('course', this.CourseFactory);

    this.UserCourseFactory = new Factory(UserCourseModel, dataSource)
      .assocOne('user', this.UserFactory)
      .assocOne('course', this.CourseFactory)
      .attr('role', Role.STUDENT);

    this.QueueFactory = new Factory(QueueModel, dataSource)
      .attr('room', 'Online')
      .assocOne('course', this.CourseFactory)
      .attr('allowQuestions', false)
      .assocMany('staffList', this.UserFactory, 0)
      .attr('isProfessorQueue', false)
      .attr('isDisabled', false)
      .attr('config', {});

    this.QueueInviteFactory = new Factory(QueueInviteModel, dataSource)
      .assocOne('queue', this.QueueFactory)
      .attr('QRCodeEnabled', true)
      .attr('isQuestionsVisible', false)
      .attr('willInviteToCourse', false)
      .attr('inviteCode', 'invite-code')
      .attr('QRCodeErrorLevel', 'L');

    this.QuestionTypeFactory = new Factory(QuestionTypeModel, dataSource)
      .attr('cid', 1)
      .attr('name', 'Question Type')
      .assocOne('queue', this.QueueFactory)
      .attr('queueId', 1)
      .attr('color', '#000000')
      .attr('questions', []);

    // WARNING: DO NOT USE CREATORID. AS YOU SEE HERE, WE ONLY ACCEPT CREATOR
    //TODO: make it accept creatorId as well
    this.QuestionFactory = new Factory(QuestionModel, dataSource)
      .attr('text', 'question description')
      .attr('status', 'Queued')
      .assocMany('questionTypes', this.QuestionTypeFactory, 1)
      .attr('groupable', true)
      .attr('isTaskQuestion', false)
      .assocOne('queue', this.QueueFactory)
      .assocOne('creator', this.UserFactory)
      .attr('createdAt', new Date());

    this.QuestionGroupFactory = new Factory(QuestionGroupModel, dataSource)
      .assocOne('creator', this.UserCourseFactory)
      .assocOne('queue', this.QueueFactory);

    this.EventFactory = new Factory(EventModel, dataSource)
      .attr('time', new Date())
      .attr('eventType', EventType.TA_CHECKED_IN)
      .assocOne('user', this.UserFactory)
      .assocOne('course', this.CourseFactory);

    this.LastRegistrationFactory = new Factory(
      LastRegistrationModel,
      dataSource,
    )
      .attr('lastRegisteredSemester', '202210') // Fall 2022
      .assocOne('prof', this.UserFactory);

    this.AlertFactory = new Factory(AlertModel, dataSource)
      .attr('alertType', AlertType.REPHRASE_QUESTION)
      .attr('sent', new Date(Date.now() - 86400000))
      .assocOne('user', this.UserFactory)
      .assocOne('course', this.CourseFactory)
      .attr('payload', {});

    this.VotesFactory = new Factory(AsyncQuestionVotesModel, dataSource)
      .attr('vote', 0)
      .attr('userId', 0);

    this.AsyncQuestionFactory = new Factory(AsyncQuestionModel, dataSource)
      .assocOne('course', this.CourseFactory)
      .assocOne('creator', this.UserFactory)
      .assocMany('votes', this.VotesFactory, 0)
      .assocMany('questionTypes', this.QuestionTypeFactory, 0)
      .attr('questionAbstract', 'abstract')
      .attr('questionText', 'text')
      .attr('aiAnswerText', 'ai answer')
      .attr('answerText', 'answer')
      .attr('status', asyncQuestionStatus.AIAnswered)
      .attr('staffSetVisible', false)
      .attr('verified', false)
      .attr('createdAt', new Date('2025-01-01T00:00:00.000Z'));

    this.AsyncQuestionCommentFactory = new Factory(
      AsyncQuestionCommentModel,
      dataSource,
    )
      .attr('commentText', 'some comment')
      .attr('createdAt', new Date('2025-01-02T00:00:00.000Z'))
      .assocOne('question', this.AsyncQuestionFactory)
      .assocOne('creator', this.UserFactory);

    this.InteractionFactory = new Factory(InteractionModel, dataSource)
      .assocOne('course', this.CourseFactory)
      .assocOne('user', this.UserFactory)
      .attr('timestamp', new Date());

    this.OrganizationCourseFactory = new Factory(
      OrganizationCourseModel,
      dataSource,
    )
      .assocOne('organization', this.OrganizationFactory)
      .assocOne('course', this.CourseFactory);

    this.OrganizationUserFactory = new Factory(
      OrganizationUserModel,
      dataSource,
    )
      .assocOne('organization', this.OrganizationFactory)
      .assocOne('organizationUser', this.UserFactory)
      .attr('role', OrganizationRole.MEMBER);

    this.ChatTokenFactory = new Factory(ChatTokenModel, dataSource)
      .attr('token', v4())
      .attr('used', 0)
      .attr('max_uses', 30)
      .assocOne('user', this.UserFactory);

    this.StudentTaskProgressFactory = new Factory(
      StudentTaskProgressModel,
      dataSource,
    )
      .assocOne('course', this.CourseFactory)
      .assocOne('user', this.UserFactory)
      .attr('taskProgress', {});

    this.mailServiceFactory = new Factory(MailServiceModel, dataSource)
      .attr('mailType', OrganizationRole.PROFESSOR)
      .attr('serviceType', MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED)
      .attr('name', 'async_question_created');

    this.userSubscriptionFactory = new Factory(
      UserSubscriptionModel,
      dataSource,
    )
      .attr('isSubscribed', true)
      .assocOne('user', this.UserFactory)
      .assocOne('service', this.mailServiceFactory);

    this.CalendarStaffFactory = new Factory(CalendarStaffModel, dataSource)
      .assocOne('user', this.UserFactory)
      .assocOne('calendar', null);

    this.calendarFactory = new Factory(CalendarModel, dataSource)
      .attr('title', 'Zoom Meeting')
      .attr('start', new Date())
      .attr('end', new Date())
      .attr('startDate', null)
      .attr('endDate', null)
      .attr('locationType', calendarEventLocationType.online)
      .attr('locationInPerson', null)
      .attr('locationOnline', 'https://zoom.us/j/example')
      .attr('allDay', false)
      .attr('daysOfWeek', [])
      .assocMany('staff', this.CalendarStaffFactory, 0)
      .assocOne('course', this.CourseFactory);

    this.dashboardPresetFactory = new Factory(InsightDashboardModel, dataSource)
      .attr('name', 'Preset')
      .attr('insights', {})
      .assocOne('userCourse', this.UserCourseFactory);

    this.lmsOrgIntFactory = new Factory(
      LMSOrganizationIntegrationModel,
      dataSource,
    )
      .attr('apiPlatform', LMSIntegrationPlatform.Canvas)
      .attr('rootUrl', '')
      .assocOne('organization', this.OrganizationFactory);

    this.lmsCourseIntFactory = new Factory(
      LMSCourseIntegrationModel,
      dataSource,
    )
      .attr('apiKeyExpiry', new Date())
      .attr('apiKey', 'abcdef')
      .attr('apiCourseId', 'abcdef')
      .assocOne('course', this.CourseFactory)
      .assocOne('orgIntegration', this.lmsOrgIntFactory);

    this.lmsAssignmentFactory = new Factory(LMSAssignmentModel, dataSource)
      .attr('name', 'assignment')
      .attr('description', 'desc')
      .assocOne('course', this.lmsCourseIntFactory);

    this.queueChatsFactory = new Factory(QueueChatsModel, dataSource)
      .attr('startedAt', new Date())
      .attr('closedAt', new Date())
      .attr('messageCount', 5)
      .assocOne('queue', this.QueueFactory)
      .assocOne('staff', this.UserFactory)
      .assocOne('student', this.UserFactory);
  }
}
