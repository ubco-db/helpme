import { Exclude } from 'class-transformer';
import { INSIGHTS_MAP } from '../insights/insight-objects';
import {
  AfterLoad,
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DesktopNotifModel } from '../notification/desktop-notif.entity';
import { QueueModel } from '../queue/queue.entity';
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

@Entity('user_model')
export class UserModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;
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
  defaultMessage: string | null;

  @Column({ type: 'boolean', default: true })
  includeDefaultMessage: boolean;

  @Column({ type: 'text', enum: AccountType, default: AccountType.LEGACY })
  accountType: AccountType;

  @Column({ type: 'boolean', default: false })
  accountDeactivated: boolean;

  @OneToMany((type) => UserCourseModel, (ucm) => ucm.user)
  @Exclude()
  courses: UserCourseModel[];

  @Column({ type: 'boolean', default: false })
  @Exclude()
  desktopNotifsEnabled: boolean; // Does user want notifications sent to their desktops?

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  userRole: UserRole;

  @OneToMany((type) => DesktopNotifModel, (notif) => notif.user)
  @Exclude()
  desktopNotifs: DesktopNotifModel[];

  @OneToMany(
    (type) => UserSubscriptionModel,
    (subscription) => subscription.user,
  )
  @Exclude()
  subscriptions: UserSubscriptionModel[];

  @Exclude()
  @ManyToMany((type) => QueueModel, (queue) => queue.staffList)
  queues: QueueModel[];

  @Exclude()
  @OneToMany((type) => EventModel, (event) => event.user)
  events: EventModel[];

  @OneToMany((type) => AlertModel, (alert) => alert.user)
  alerts: AlertModel[];

  @Exclude()
  @Column({ type: 'simple-array', nullable: true })
  hideInsights: string[];

  insights: string[];

  @OneToOne((type) => OrganizationUserModel, (ou) => ou.organizationUser)
  organizationUser: OrganizationUserModel;

  @OneToMany((type) => InteractionModel, (interaction) => interaction.user)
  @JoinColumn({ name: 'user' })
  interactions: InteractionModel[];

  @OneToMany((type) => UserTokenModel, (userToken) => userToken.user)
  tokens: UserTokenModel[];

  @OneToOne((type) => ChatTokenModel, (chatToken) => chatToken.user, {
    cascade: true,
  })
  chat_token: ChatTokenModel;

  @AfterLoad()
  computeInsights(): void {
    let hideInsights = this.hideInsights;
    if (!hideInsights) {
      hideInsights = [];
    }
    const insightNames = Object.keys(INSIGHTS_MAP);
    this.insights = insightNames.filter((name) => !hideInsights.includes(name));
  }

  name: string;

  @AfterLoad()
  setFullNames(): void {
    // it is possible that lastname is null
    this.name = this.firstName + ' ' + (this.lastName ?? '');
  }

  @OneToMany(
    (type) => StudentTaskProgressModel,
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

  @OneToMany((type) => CalendarStaffModel, (csm) => csm.user)
  @Exclude()
  calendarEvents: CalendarStaffModel[];

  @Column({ type: 'boolean', default: false })
  readChangeLog: boolean;

  @OneToMany(
    (type) => UnreadAsyncQuestionModel,
    (unreadAsyncQuestion) => unreadAsyncQuestion.user,
  )
  @Exclude()
  unreadAsyncQuestions: UnreadAsyncQuestionModel[];

  @OneToMany((type) => QuestionModel, (q) => q.creator)
  @Exclude()
  questions: QuestionModel[];

  @OneToMany((type) => AsyncQuestionModel, (aq) => aq.creator)
  @Exclude()
  asyncQuestions: AsyncQuestionModel[];

  @OneToMany((type) => AsyncQuestionCommentModel, (aqc) => aqc.creator)
  @Exclude()
  asyncQuestionComments: CalendarStaffModel[];
}
