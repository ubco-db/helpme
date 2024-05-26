import { config } from 'dotenv';
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
import { ProfSectionGroupsModel } from './src/login/prof-section-groups.entity';
import { QuestionTypeModel } from './src/questionType/question-type.entity';
import { AsyncQuestionModel } from './src/asyncQuestion/asyncQuestion.entity';
import { ChatbotQuestionModel } from './src/chatbot/question.entity';
import { InteractionModel } from './src/chatbot/interaction.entity';
import { QuestionDocumentModel } from './src/chatbot/questionDocument.entity';
import { CalendarModel } from './src/calendar/calendar.entity';
import { OrganizationUserModel } from './src/organization/organization-user.entity';
import { OrganizationModel } from './src/organization/organization.entity';
import { OrganizationCourseModel } from './src/organization/organization-course.entity';
import { ChatbotDocumentModel } from './src/chatbot/chatbotDocument.entity';
import { CourseSettingsModel } from './src/course/course_settings.entity';
import { AsyncQuestionVotesModel } from './src/asyncQuestion/asyncQuestionVotes.entity';
import { UserTokenModel } from './src/profile/user-token.entity';
import { StudentTaskProgress } from 'studentTaskProgress/studentTaskProgress.entity';

config();

// Options only used whe run via CLI
const inCLI = {
  migrations: ['migration/*.ts'],
  cli: {
    migrationsDir: 'migration',
  },
};

const typeorm = {
  type: 'postgres',
  url:
    process.env.DB_URL ||
    'postgres://helpme:mysecretpassword@localhost:5432/dev',
  synchronize: process.env.NODE_ENV !== 'production',
  entities: [
    CourseModel,
    CourseSectionMappingModel,
    SemesterModel,
    UserModel,
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
    LastRegistrationModel,
    ProfSectionGroupsModel,
    QuestionDocumentModel,
    OrganizationUserModel,
    OrganizationModel,
    OrganizationCourseModel,
    ChatbotDocumentModel,
    CourseSettingsModel,
    AsyncQuestionVotesModel,
    UserTokenModel,
    StudentTaskProgress,
  ],
  keepConnectionAlive: true,
  logging:
    process.env.NODE_ENV !== 'production'
      ? ['error']
      : !!process.env.TYPEORM_LOGGING,
  ...(!!process.env.TYPEORM_CLI ? inCLI : {}),
};
module.exports = typeorm;
