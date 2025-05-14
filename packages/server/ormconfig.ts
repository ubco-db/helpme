import { config } from 'dotenv';
import { isProd } from '@koh/common';
import * as fs from 'fs';
import { DataSourceOptions } from 'typeorm';
import { AdminUserModel } from './src/admin/admin-user.entity';
import { CourseModel } from './src/course/course.entity';
import { SemesterModel } from './src/semester/semester.entity';
import { CourseSectionMappingModel } from './src/login/course-section-mapping.entity';
import { DesktopNotifModel } from './src/notification/desktop-notif.entity';
import { EventModel } from './src/profile/event-model.entity';
import { UserCourseModel } from './src/profile/user-course.entity';
import { UserModel } from './src/profile/user.entity';
import { QuestionModel } from './src/question/question.entity';
import { QuestionGroupModel } from './src/question/question-group.entity';
import { QueueModel } from './src/queue/queue.entity';
import { AlertModel } from './src/alerts/alerts.entity';
import { LastRegistrationModel } from './src/login/last-registration-model.entity';
import { QuestionTypeModel } from './src/questionType/question-type.entity';
import { AsyncQuestionModel } from './src/asyncQuestion/asyncQuestion.entity';
import { ChatbotQuestionModel } from './src/chatbot/question.entity';
import { InteractionModel } from './src/chatbot/interaction.entity';
import { QuestionDocumentModel } from './src/chatbot/questionDocument.entity';
import { CalendarModel } from './src/calendar/calendar.entity';
import { CalendarStaffModel } from './src/calendar/calendar-staff.entity';
import { OrganizationUserModel } from './src/organization/organization-user.entity';
import { OrganizationModel } from './src/organization/organization.entity';
import { MailServiceModel } from './src/mail/mail-services.entity';
import { UserSubscriptionModel } from './src/mail/user-subscriptions.entity';
import { OrganizationCourseModel } from './src/organization/organization-course.entity';
import { CourseSettingsModel } from './src/course/course_settings.entity';
import { AsyncQuestionVotesModel } from './src/asyncQuestion/asyncQuestionVotes.entity';
import { UserTokenModel } from './src/profile/user-token.entity';
import { ChatTokenModel } from './src/chatbot/chat-token.entity';
import { StudentTaskProgressModel } from './src/studentTaskProgress/studentTaskProgress.entity';
import { ApplicationConfigModel } from './src/config/application_config.entity';
import { InsightDashboardModel } from './src/insights/dashboard.entity';
import { QueueInviteModel } from './src/queue/queue-invite.entity';
import { QueueChatsModel } from './src/queueChats/queue-chats.entity';
import { LMSOrganizationIntegrationModel } from './src/lmsIntegration/lmsOrgIntegration.entity';
import { LMSCourseIntegrationModel } from './src/lmsIntegration/lmsCourseIntegration.entity';
import { LMSAssignmentModel } from './src/lmsIntegration/lmsAssignment.entity';
import { LMSAnnouncementModel } from './src/lmsIntegration/lmsAnnouncement.entity';
import { UnreadAsyncQuestionModel } from './src/asyncQuestion/unread-async-question.entity';
import { AsyncQuestionCommentModel } from './src/asyncQuestion/asyncQuestionComment.entity';
import { ChatbotDocPdfModel } from './src/chatbot/chatbot-doc-pdf.entity';
import { SuperCourseModel } from './src/course/super-course.entity';
// set .envs to their default values if the developer hasn't yet set them
if (fs.existsSync('.env')) {
  config();
} else {
  console.log(
    'No .env file found, using .env.development as fallback. If you are a new developer, please create your .env files (see NEWDEVS_STARTHERE.md)',
  );
  config({ path: '.env.development' });
}
if (fs.existsSync('postgres.env')) {
  config({ path: 'postgres.env' });
} else {
  console.error(
    'No postgres.env file found. If you are a new developer, please create your postgres.env file from postgres.env.example (see NEWDEVS_STARTHERE.md). Your database will not connect without it.',
  );
}
// Options only used whe run via CLI
const inCLI = {
  migrations: ['migration/*.ts'],
};

const typeorm: DataSourceOptions = {
  type: 'postgres',
  url: !isProd()
    ? `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/dev`
    : `postgres://${process.env.POSTGRES_NONROOT_USER}:${process.env.POSTGRES_NONROOT_PASSWORD}@coursehelp.ubc.ca:5432/prod`,
  synchronize: process.env.NODE_ENV !== 'production',
  entities: [
    CourseModel,
    MailServiceModel,
    CourseSectionMappingModel,
    SemesterModel,
    UserModel,
    UserSubscriptionModel,
    UserCourseModel,
    QuestionModel,
    ChatbotQuestionModel,
    InteractionModel,
    AsyncQuestionModel,
    QuestionTypeModel,
    QueueModel,
    DesktopNotifModel,
    AdminUserModel,
    EventModel,
    QuestionGroupModel,
    AlertModel,
    CalendarModel,
    CalendarStaffModel,
    LastRegistrationModel,
    QuestionDocumentModel,
    OrganizationUserModel,
    OrganizationModel,
    OrganizationCourseModel,
    CourseSettingsModel,
    AsyncQuestionVotesModel,
    AsyncQuestionCommentModel,
    UserTokenModel,
    ChatTokenModel,
    StudentTaskProgressModel,
    ApplicationConfigModel,
    QueueInviteModel,
    QueueChatsModel,
    InsightDashboardModel,
    LMSOrganizationIntegrationModel,
    LMSCourseIntegrationModel,
    LMSAssignmentModel,
    UnreadAsyncQuestionModel,
    LMSAnnouncementModel,
    ChatbotDocPdfModel,
    SuperCourseModel,
  ],
  logging:
    process.env.NODE_ENV !== 'production'
      ? ['error', 'warn']
      : !!process.env.TYPEORM_LOGGING,
  ...(!!process.env.TYPEORM_CLI ? inCLI : {}),
};
module.exports = typeorm;
