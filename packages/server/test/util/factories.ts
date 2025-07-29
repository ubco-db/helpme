import { FactoryService } from 'factory/factory.service';

// IMPORTANT: In order to use ANY of these factories, you must make sure FactoryModule is an import in createTestingModule
// AND you must get the FactoryService and pass it into initFactoriesFromService
export let UserFactory: FactoryService['UserFactory'];
export let StudentCourseFactory: FactoryService['StudentCourseFactory'];
export let TACourseFactory: FactoryService['TACourseFactory'];
export let SemesterFactory: FactoryService['SemesterFactory'];
export let CourseFactory: FactoryService['CourseFactory'];
export let CourseSettingsFactory: FactoryService['CourseSettingsFactory'];
export let UserCourseFactory: FactoryService['UserCourseFactory'];
export let QueueFactory: FactoryService['QueueFactory'];
export let QueueInviteFactory: FactoryService['QueueInviteFactory'];
export let QuestionTypeFactory: FactoryService['QuestionTypeFactory'];
export let QuestionFactory: FactoryService['QuestionFactory'];
export let QuestionGroupFactory: FactoryService['QuestionGroupFactory'];
export let EventFactory: FactoryService['EventFactory'];
export let AlertFactory: FactoryService['AlertFactory'];
export let VotesFactory: FactoryService['VotesFactory'];
export let AsyncQuestionFactory: FactoryService['AsyncQuestionFactory'];
export let AsyncQuestionCommentFactory: FactoryService['AsyncQuestionCommentFactory'];
export let OrganizationFactory: FactoryService['OrganizationFactory'];
export let InteractionFactory: FactoryService['InteractionFactory'];
export let OrganizationCourseFactory: FactoryService['OrganizationCourseFactory'];
export let OrganizationUserFactory: FactoryService['OrganizationUserFactory'];
export let ChatTokenFactory: FactoryService['ChatTokenFactory'];
export let StudentTaskProgressFactory: FactoryService['StudentTaskProgressFactory'];
export let mailServiceFactory: FactoryService['mailServiceFactory'];
export let userSubscriptionFactory: FactoryService['userSubscriptionFactory'];
export let CalendarStaffFactory: FactoryService['CalendarStaffFactory'];
export let calendarFactory: FactoryService['calendarFactory'];
export let dashboardPresetFactory: FactoryService['dashboardPresetFactory'];
export let lmsOrgIntFactory: FactoryService['lmsOrgIntFactory'];
export let lmsCourseIntFactory: FactoryService['lmsCourseIntFactory'];
export let lmsAssignmentFactory: FactoryService['lmsAssignmentFactory'];
export let queueChatsFactory: FactoryService['queueChatsFactory'];
export let OrganizationSettingsFactory: FactoryService['OrganizationSettingsFactory'];
export let OrganizationChatbotSettingsFactory: FactoryService['OrganizationChatbotSettingsFactory'];
export let ChatbotProviderFactory: FactoryService['ChatbotProviderFactory'];
export let LLMTypeFactory: FactoryService['LLMTypeFactory'];
export let CourseChatbotSettingsFactory: FactoryService['CourseChatbotSettingsFactory'];
// We keep a helper so that in the test setup, once we have the real service,
// we can “wire up” these variables.
export function initFactoriesFromService(service: FactoryService) {
  UserFactory = service.UserFactory;
  StudentCourseFactory = service.StudentCourseFactory;
  TACourseFactory = service.TACourseFactory;
  SemesterFactory = service.SemesterFactory;
  CourseFactory = service.CourseFactory;
  CourseSettingsFactory = service.CourseSettingsFactory;
  UserCourseFactory = service.UserCourseFactory;
  QueueFactory = service.QueueFactory;
  QueueInviteFactory = service.QueueInviteFactory;
  QuestionTypeFactory = service.QuestionTypeFactory;
  QuestionFactory = service.QuestionFactory;
  QuestionGroupFactory = service.QuestionGroupFactory;
  EventFactory = service.EventFactory;
  AlertFactory = service.AlertFactory;
  VotesFactory = service.VotesFactory;
  AsyncQuestionFactory = service.AsyncQuestionFactory;
  AsyncQuestionCommentFactory = service.AsyncQuestionCommentFactory;
  OrganizationFactory = service.OrganizationFactory;
  InteractionFactory = service.InteractionFactory;
  OrganizationCourseFactory = service.OrganizationCourseFactory;
  OrganizationUserFactory = service.OrganizationUserFactory;
  ChatTokenFactory = service.ChatTokenFactory;
  StudentTaskProgressFactory = service.StudentTaskProgressFactory;
  mailServiceFactory = service.mailServiceFactory;
  userSubscriptionFactory = service.userSubscriptionFactory;
  CalendarStaffFactory = service.CalendarStaffFactory;
  calendarFactory = service.calendarFactory;
  dashboardPresetFactory = service.dashboardPresetFactory;
  lmsOrgIntFactory = service.lmsOrgIntFactory;
  lmsCourseIntFactory = service.lmsCourseIntFactory;
  lmsAssignmentFactory = service.lmsAssignmentFactory;
  queueChatsFactory = service.queueChatsFactory;
  OrganizationSettingsFactory = service.OrganizationSettingsFactory;
  OrganizationChatbotSettingsFactory =
    service.OrganizationChatbotSettingsFactory;
  ChatbotProviderFactory = service.ChatbotProviderFactory;
  LLMTypeFactory = service.LLMTypeFactory;
  CourseChatbotSettingsFactory = service.CourseChatbotSettingsFactory;
}
