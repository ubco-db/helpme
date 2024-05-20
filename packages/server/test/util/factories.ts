import { QuestionGroupModel } from 'question/question-group.entity';
import {
  AlertType,
  OrganizationRole,
  Role,
  asyncQuestionStatus,
} from '@koh/common';
import { AlertModel } from 'alerts/alerts.entity';
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
import { ProfSectionGroupsModel } from 'login/prof-section-groups.entity';
import { OrganizationModel } from '../../src/organization/organization.entity';
import { InteractionModel } from '../../src/chatbot/interaction.entity';
import { OrganizationCourseModel } from '../../src/organization/organization-course.entity';
import { QuestionTypeModel } from '../../src/questionType/question-type.entity';
import { OrganizationUserModel } from '../../src/organization/organization-user.entity';
import { CourseSettingsModel } from '../../src/course/course_settings.entity';
import { AsyncQuestionModel } from '../../src/asyncQuestion/asyncQuestion.entity';
import { AsyncQuestionVotesModel } from '../../src/asyncQuestion/asyncQuestionVotes.entity';
import { ChatTokenModel } from '../../src/chatbot/chat-token.entity';
import { v4 } from 'uuid';

export const UserFactory = new Factory(UserModel)
  .attr('email', `user@ubc.ca`)
  .attr('firstName', 'User')
  .attr('lastName', 'Person')
  .attr('emailVerified', true)
  .attr('hideInsights', []);

export const StudentCourseFactory = new Factory(UserCourseModel).attr(
  'role',
  Role.STUDENT,
);

export const TACourseFactory = new Factory(UserCourseModel).attr(
  'role',
  Role.TA,
);

export const SemesterFactory = new Factory(SemesterModel)
  .attr('season', 'Fall')
  .attr('year', 2022);

export const CourseFactory = new Factory(CourseModel)
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

export const CourseSettingsFactory = new Factory(CourseSettingsModel)
  .assocOne('course', CourseFactory)
  .attr('chatBotEnabled', true)
  .attr('asyncQueueEnabled', true)
  .attr('adsEnabled', true)
  .attr('queueEnabled', true);

export const CourseSectionFactory = new Factory(CourseSectionMappingModel)
  .attr('crn', 12345)
  .assocOne('course', CourseFactory);

export const UserCourseFactory = new Factory(UserCourseModel)
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory)
  .attr('role', Role.STUDENT);

export const QueueFactory = new Factory(QueueModel)
  .attr('room', 'Online')
  .assocOne('course', CourseFactory)
  .attr('allowQuestions', false)
  .assocMany('staffList', UserFactory, 0)
  .attr('isProfessorQueue', false)
  .attr('isDisabled', false);

export const QuestionTypeFactory = new Factory(QuestionTypeModel)
  .attr('cid', 1)
  .attr('name', 'Question Type')
  .assocOne('queue', QueueFactory)
  .attr('queueId', 1)
  .attr('color', '#000000')
  .attr('questions', []);

// WARNING: DO NOT USE CREATORID. AS YOU SEE HERE, WE ONLY ACCEPT CREATOR
//TODO: make it accept creatorId as well
export const QuestionFactory = new Factory(QuestionModel)
  .attr('text', 'question description')
  .attr('status', 'Queued')
  .assocMany('questionTypes', QuestionTypeFactory, 1)
  .attr('groupable', true)
  .assocOne('queue', QueueFactory)
  .assocOne('creator', UserFactory)
  .attr('createdAt', new Date());

export const QuestionGroupFactory = new Factory(QuestionGroupModel)
  .assocOne('creator', UserCourseFactory)
  .assocOne('queue', QueueFactory);

export const EventFactory = new Factory(EventModel)
  .attr('time', new Date())
  .attr('eventType', EventType.TA_CHECKED_IN)
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory);

export const LastRegistrationFactory = new Factory(LastRegistrationModel)
  .attr('lastRegisteredSemester', '202210') // Fall 2022
  .assocOne('prof', UserFactory);

export const ProfSectionGroupsFactory = new Factory(ProfSectionGroupsModel)
  .assocOne('prof', UserFactory)
  .attr('sectionGroups', []);

export const AlertFactory = new Factory(AlertModel)
  .attr('alertType', AlertType.REPHRASE_QUESTION)
  .attr('sent', new Date(Date.now() - 86400000))
  .assocOne('user', UserFactory)
  .assocOne('course', CourseFactory)
  .attr('payload', {});

export const VotesFactory = new Factory(AsyncQuestionVotesModel)
  .attr('vote', 0)
  .attr('userId', 0);

export const AsyncQuestionFactory = new Factory(AsyncQuestionModel)
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
  .attr('createdAt', new Date());

export const OrganizationFactory = new Factory(OrganizationModel)
  .attr('name', 'UBCO')
  .attr('description', 'UBC Okanagan');

export const InteractionFactory = new Factory(InteractionModel)
  .assocOne('course', CourseFactory)
  .assocOne('user', UserFactory)
  .attr('timestamp', new Date());

export const OrganizationCourseFactory = new Factory(OrganizationCourseModel)
  .assocOne('organization', OrganizationFactory)
  .assocOne('course', CourseFactory);

export const OrganizationUserFactory = new Factory(OrganizationUserModel)
  .assocOne('organization', OrganizationFactory)
  .assocOne('organizationUser', UserFactory)
  .attr('role', OrganizationRole.MEMBER);

export const ChatTokenFactory = new Factory(ChatTokenModel)
  .attr('token', v4())
  .attr('used', 0)
  .attr('max_uses', 30)
  .assocOne('user', UserFactory);
