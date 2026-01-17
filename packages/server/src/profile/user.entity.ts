import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DesktopNotifModel } from '../notification/desktop-notif.entity';
import { EventModel } from './event-model.entity';
import { UserCourseModel } from './user-course.entity';
import { AlertModel } from '../alerts/alerts.entity';
import { AccountType, UserRole } from '@koh/common';
import { OrganizationUserModel } from '../organization/organization-user.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { UserTokenModel } from './user-token.entity';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { StudentTaskProgressModel } from '../studentTaskProgress/studentTaskProgress.entity';
import { UserSubscriptionModel } from '../mail/user-subscriptions.entity';
import { QueueChatsModel } from '../queueChats/queue-chats.entity';
import { CalendarStaffModel } from '../calendar/calendar-staff.entity';
import { UnreadAsyncQuestionModel } from '../asyncQuestion/unread-async-question.entity';
import { AsyncQuestionCommentModel } from '../asyncQuestion/asyncQuestionComment.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { QuestionModel } from '../question/question.entity';
import { LMSAuthStateModel } from '../lmsIntegration/lms-auth-state.entity';
import { LMSAccessTokenModel } from '../lmsIntegration/lms-access-token.entity';
import { UserLtiIdentityModel } from '../lti/user_lti_identity.entity';
import { QueueStaffModel } from 'queue/queue-staff/queue-staff.entity';

@Entity('user_model')
export class UserModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @Column('int', { nullable: true })
  sid: number;

  @Column('text')
  email: string;

  @Column('text', { nullable: true })
  @Exclude()
  password: string | null;

  @Column('text', { nullable: true })
  firstName: string;

  @Column('text', { nullable: true })
  lastName: string;

  @Column('text', { nullable: true })
  photoURL: string | null;

  @Column('boolean', { default: false })
  emailVerified: boolean;

  @Column('text', { nullable: true })
  defaultMessage: string | null; //unused

  @Column({ type: 'boolean', default: true })
  includeDefaultMessage: boolean; //unused

  @Column({ type: 'text', enum: AccountType, default: AccountType.LEGACY })
  accountType: AccountType;

  @Column({ type: 'boolean', default: false })
  accountDeactivated: boolean;

  @OneToMany(() => UserCourseModel, (ucm) => ucm.user)
  @Exclude()
  courses: UserCourseModel[];

  @Column({ type: 'boolean', default: false })
  @Exclude()
  desktopNotifsEnabled: boolean; // Does user want notifications sent to their desktops?

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  userRole: UserRole;

  @OneToMany(() => DesktopNotifModel, (notif) => notif.user)
  @Exclude()
  desktopNotifs: DesktopNotifModel[];

  @OneToMany(() => UserSubscriptionModel, (subscription) => subscription.user)
  @Exclude()
  subscriptions: UserSubscriptionModel[];

  @OneToMany((_type) => QueueStaffModel, (queueStaff) => queueStaff.user)
  queueStaff: QueueStaffModel[];

  @Exclude()
  @OneToMany(() => EventModel, (event) => event.user)
  events: EventModel[];

  @OneToMany(() => AlertModel, (alert) => alert.user)
  alerts: AlertModel[];

  @Exclude()
  @Column({ type: 'simple-array', nullable: true })
  hideInsights: string[];

  @OneToOne(() => OrganizationUserModel, (ou) => ou.organizationUser)
  organizationUser: OrganizationUserModel;

  @OneToMany(() => InteractionModel, (interaction) => interaction.user)
  @JoinColumn({ name: 'user' })
  interactions: InteractionModel[];

  @OneToMany(() => UserTokenModel, (userToken) => userToken.user)
  tokens: UserTokenModel[];

  @OneToOne(() => ChatTokenModel, (chatToken) => chatToken.user, {
    cascade: true,
  })
  chat_token: ChatTokenModel;

  @Column({
    generatedType: 'STORED',
    asExpression: `COALESCE("firstName", '') || ' ' || COALESCE("lastName", '')`,
  })
  name: string;

  @OneToMany(
    () => StudentTaskProgressModel,
    (taskProgress) => taskProgress.user,
  )
  @Exclude()
  taskProgress: StudentTaskProgressModel[];

  @OneToMany(() => QueueChatsModel, (queueChat) => queueChat.staff)
  @Exclude()
  staffChats: QueueChatsModel[];

  @OneToMany(() => QueueChatsModel, (queueChat) => queueChat.student)
  @Exclude()
  studentChats: QueueChatsModel[];

  @OneToMany(() => CalendarStaffModel, (csm) => csm.user)
  @Exclude()
  calendarEvents: CalendarStaffModel[];

  @Column({ type: 'boolean', default: false })
  readChangeLog: boolean;

  @OneToMany(
    () => UnreadAsyncQuestionModel,
    (unreadAsyncQuestion) => unreadAsyncQuestion.user,
  )
  @Exclude()
  unreadAsyncQuestions: UnreadAsyncQuestionModel[];

  @OneToMany(() => QuestionModel, (q) => q.creator)
  @Exclude()
  questions: QuestionModel[];

  @OneToMany(() => AsyncQuestionModel, (aq) => aq.creator)
  @Exclude()
  asyncQuestions: AsyncQuestionModel[];

  @OneToMany(() => AsyncQuestionCommentModel, (aqc) => aqc.creator)
  @Exclude()
  asyncQuestionComments: AsyncQuestionCommentModel[];

  @OneToMany(() => LMSAuthStateModel, (authState) => authState.user)
  @Exclude()
  pendingAuthStates: LMSAuthStateModel[];

  @Exclude()
  @OneToMany(() => LMSAccessTokenModel, (accessToken) => accessToken.user)
  lmsAccessTokens: LMSAccessTokenModel[];

  @Exclude()
  @OneToMany(() => UserLtiIdentityModel, (identity) => identity.user)
  ltiIdentities: UserLtiIdentityModel[];
}
