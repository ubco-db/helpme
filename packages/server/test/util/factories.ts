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
import { AlertModel } from '../../src/alerts/alerts.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { Factory } from 'typeorm-factory';
import { CourseModel } from '../../src/course/course.entity';
import { SemesterModel } from '../../src/semester/semester.entity';
import { CourseSectionMappingModel } from '../../src/login/course-section-mapping.entity';
import { UserCourseModel } from '../../src/profile/user-course.entity';
import { UserModel } from '../../src/profile/user.entity';
import { QuestionModel } from '../../src/question/question.entity';
import { QueueModel } from '../../src/queue/queue.entity';
import { LastRegistrationModel } from 'login/last-registration-model.entity';
import { OrganizationModel } from '../../src/organization/organization.entity';
import { InteractionModel } from '../../src/chatbot/interaction.entity';
import { OrganizationCourseModel } from '../../src/organization/organization-course.entity';
import { QuestionTypeModel } from '../../src/questionType/question-type.entity';
import { OrganizationUserModel } from '../../src/organization/organization-user.entity';
import { CourseSettingsModel } from '../../src/course/course_settings.entity';
import { AsyncQuestionModel } from '../../src/asyncQuestion/asyncQuestion.entity';
import { AsyncQuestionVotesModel } from '../../src/asyncQuestion/asyncQuestionVotes.entity';
import { ChatTokenModel } from '../../src/chatbot/chat-token.entity';
import { MailServiceModel } from '../../src/mail/mail-services.entity';
import { UserSubscriptionModel } from '../../src/mail/user-subscriptions.entity';
import { v4 } from 'uuid';
import { StudentTaskProgressModel } from '../../src/studentTaskProgress/studentTaskProgress.entity';
import { CalendarModel } from '../../src/calendar/calendar.entity';
import { QueueInviteModel } from '../../src/queue/queue-invite.entity';
import { InsightDashboardModel } from '../../src/insights/dashboard.entity';
import { LMSOrganizationIntegrationModel } from '../../src/lmsIntegration/lmsOrgIntegration.entity';
import { LMSCourseIntegrationModel } from '../../src/lmsIntegration/lmsCourseIntegration.entity';
import { LMSAssignmentModel } from '../../src/lmsIntegration/lmsAssignment.entity';
import { CalendarStaffModel } from '../../src/calendar/calendar-staff.entity';
import { AsyncQuestionCommentModel } from '../../src/asyncQuestion/asyncQuestionComment.entity';
import { QueueChatsModel } from '../../src/queueChats/queue-chats.entity';
import { TestDataSource } from './testUtils';

export const UserFactory = new Factory(UserModel, TestDataSource)
  .attr('email', `user@ubc.ca`)
  .attr('firstName', 'User')
  .attr('lastName', 'Person')
  .attr('emailVerified', true)
  .attr('photoURL', 'https://example.com')
  .attr('hideInsights', []);

export const StudentCourseFactory = new Factory(
  UserCourseModel,
  TestDataSource,
).attr('role', Role.STUDENT);

export const TACourseFactory = new Factory(
  UserCourseModel,
  TestDataSource,
).attr('role', Role.TA);

export const SemesterFactory = new Factory(SemesterModel, TestDataSource)
  .attr('season', 'Fall')
  .attr('year', 2022);

export const CourseFactory = new Factory(CourseModel, TestDataSource)
  .attr('name', 'CS 304')
  // calendar is owned by sandboxneu@gmail.com
  .attr(
    'icalURL',
    'https://calendar.google.com/calendar/ical/t6lu2pic7u9otrbpkuk26sl34g%40group.calendar.google.com/public/basic.ics',
  )
  .attr('sectionGroupName', 'CS 304')
  .attr('enabled', true)
  .attr('courseInviteCode', 'invite-code')
  .assocOne('semester', SemesterFactory);

export const CourseSettingsFactory = new Factory(
  CourseSettingsModel,
  TestDataSource,
)
  .assocOne('course', CourseFactory)
  .attr('chatBotEnabled', true)
  .attr('asyncQueueEnabled', true)
  .attr('adsEnabled', true)
  .attr('queueEnabled', true);

export const CourseSectionFactory = new Factory(
  CourseSectionMappingModel,
  TestDataSource,
)
  .attr('crn', 12345)
  .assocOne('course', CourseFactory);

export const UserCourseFactory = new Factory(UserCourseModel, TestDataSource)
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory)
  .attr('role', Role.STUDENT);

export const QueueFactory = new Factory(QueueModel, TestDataSource)
  .attr('room', 'Online')
  .assocOne('course', CourseFactory)
  .attr('allowQuestions', false)
  .assocMany('staffList', UserFactory, 0)
  .attr('isProfessorQueue', false)
  .attr('isDisabled', false)
  .attr('config', {});

export const QueueInviteFactory = new Factory(QueueInviteModel, TestDataSource)
  .assocOne('queue', QueueFactory)
  .attr('QRCodeEnabled', true)
  .attr('isQuestionsVisible', false)
  .attr('willInviteToCourse', false)
  .attr('inviteCode', 'invite-code')
  .attr('QRCodeErrorLevel', 'L');

export const QuestionTypeFactory = new Factory(
  QuestionTypeModel,
  TestDataSource,
)
  .attr('cid', 1)
  .attr('name', 'Question Type')
  .assocOne('queue', QueueFactory)
  .attr('queueId', 1)
  .attr('color', '#000000')
  .attr('questions', []);

// WARNING: DO NOT USE CREATORID. AS YOU SEE HERE, WE ONLY ACCEPT CREATOR
//TODO: make it accept creatorId as well
export const QuestionFactory = new Factory(QuestionModel, TestDataSource)
  .attr('text', 'question description')
  .attr('status', 'Queued')
  .assocMany('questionTypes', QuestionTypeFactory, 1)
  .attr('groupable', true)
  .attr('isTaskQuestion', false)
  .assocOne('queue', QueueFactory)
  .assocOne('creator', UserFactory)
  .attr('createdAt', new Date());

export const QuestionGroupFactory = new Factory(
  QuestionGroupModel,
  TestDataSource,
)
  .assocOne('creator', UserCourseFactory)
  .assocOne('queue', QueueFactory);

export const EventFactory = new Factory(EventModel, TestDataSource)
  .attr('time', new Date())
  .attr('eventType', EventType.TA_CHECKED_IN)
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory);

export const LastRegistrationFactory = new Factory(
  LastRegistrationModel,
  TestDataSource,
)
  .attr('lastRegisteredSemester', '202210') // Fall 2022
  .assocOne('prof', UserFactory);

export const AlertFactory = new Factory(AlertModel, TestDataSource)
  .attr('alertType', AlertType.REPHRASE_QUESTION)
  .attr('sent', new Date(Date.now() - 86400000))
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory)
  .attr('payload', {});

export const VotesFactory = new Factory(AsyncQuestionVotesModel, TestDataSource)
  .attr('vote', 0)
  .attr('userId', 0);

export const AsyncQuestionFactory = new Factory(
  AsyncQuestionModel,
  TestDataSource,
)
  .assocOne('course', CourseFactory)
  .assocOne('creator', UserFactory)
  .assocMany('votes', VotesFactory, 0)
  .assocMany('questionTypes', QuestionTypeFactory, 0)
  .attr('questionAbstract', 'abstract')
  .attr('questionText', 'text')
  .attr('aiAnswerText', 'ai answer')
  .attr('answerText', 'answer')
  .attr('status', asyncQuestionStatus.AIAnswered)
  .attr('visible', false)
  .attr('verified', false)
  .attr('createdAt', new Date('2025-01-01T00:00:00.000Z'));

export const AsyncQuestionCommentFactory = new Factory(
  AsyncQuestionCommentModel,
  TestDataSource,
)
  .attr('commentText', 'some comment')
  .attr('createdAt', new Date('2025-01-02T00:00:00.000Z'))
  .assocOne('question', AsyncQuestionFactory)
  .assocOne('creator', UserFactory);

export const OrganizationFactory = new Factory(
  OrganizationModel,
  TestDataSource,
)
  .attr('name', 'UBCO')
  .attr('description', 'UBC Okanagan');

export const InteractionFactory = new Factory(InteractionModel, TestDataSource)
  .assocOne('course', CourseFactory)
  .assocOne('user', UserFactory)
  .attr('timestamp', new Date());

export const OrganizationCourseFactory = new Factory(
  OrganizationCourseModel,
  TestDataSource,
)
  .assocOne('organization', OrganizationFactory)
  .assocOne('course', CourseFactory);

export const OrganizationUserFactory = new Factory(
  OrganizationUserModel,
  TestDataSource,
)
  .assocOne('organization', OrganizationFactory)
  .assocOne('organizationUser', UserFactory)
  .attr('role', OrganizationRole.MEMBER);

export const ChatTokenFactory = new Factory(ChatTokenModel, TestDataSource)
  .attr('token', v4())
  .attr('used', 0)
  .attr('max_uses', 30)
  .assocOne('user', UserFactory);

export const StudentTaskProgressFactory = new Factory(
  StudentTaskProgressModel,
  TestDataSource,
)
  .assocOne('course', CourseFactory)
  .assocOne('user', UserFactory)
  .attr('taskProgress', {});

export const mailServiceFactory = new Factory(MailServiceModel, TestDataSource)
  .attr('mailType', OrganizationRole.PROFESSOR)
  .attr('serviceType', MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED)
  .attr('name', 'async_question_created');

export const userSubscriptionFactory = new Factory(
  UserSubscriptionModel,
  TestDataSource,
)
  .attr('isSubscribed', true)
  .assocOne('user', UserFactory)
  .assocOne('service', mailServiceFactory);

export const CalendarStaffFactory = new Factory(
  CalendarStaffModel,
  TestDataSource,
)
  .assocOne('user', UserFactory)
  .assocOne('calendar', null);

export const calendarFactory = new Factory(CalendarModel, TestDataSource)
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
  .assocMany('staff', CalendarStaffFactory, 0)
  .assocOne('course', CourseFactory);

export const dashboardPresetFactory = new Factory(
  InsightDashboardModel,
  TestDataSource,
)
  .attr('name', 'Preset')
  .attr('insights', {})
  .assocOne('userCourse', UserCourseFactory);

export const lmsOrgIntFactory = new Factory(
  LMSOrganizationIntegrationModel,
  TestDataSource,
)
  .attr('apiPlatform', LMSIntegrationPlatform.Canvas)
  .attr('rootUrl', '')
  .assocOne('organization', OrganizationFactory);

export const lmsCourseIntFactory = new Factory(
  LMSCourseIntegrationModel,
  TestDataSource,
)
  .attr('apiKeyExpiry', new Date())
  .attr('apiKey', 'abcdef')
  .attr('apiCourseId', 'abcdef')
  .assocOne('course', CourseFactory)
  .assocOne('orgIntegration', lmsOrgIntFactory);

export const lmsAssignmentFactory = new Factory(
  LMSAssignmentModel,
  TestDataSource,
)
  .attr('name', 'assignment')
  .attr('description', 'desc')
  .assocOne('course', lmsCourseIntFactory);

export const queueChatsFactory = new Factory(QueueChatsModel, TestDataSource)
  .attr('startedAt', new Date())
  .attr('closedAt', new Date())
  .attr('messageCount', 5)
  .assocOne('queue', QueueFactory)
  .assocOne('staff', UserFactory)
  .assocOne('student', UserFactory);
