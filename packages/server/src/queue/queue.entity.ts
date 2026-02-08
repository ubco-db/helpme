import { Exclude } from 'class-transformer';
import { QuestionGroupModel } from '../question/question-group.entity';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { QuestionModel } from '../question/question.entity';
import {
  OpenQuestionStatus,
  QueueConfig,
  QueueTypes,
  StatusInQueue,
} from '@koh/common';
import { QuestionTypeModel } from '../questionType/question-type.entity';
import { QueueInviteModel } from './queue-invite.entity';
import { QueueChatsModel } from '../queueChats/queue-chats.entity';
import { QueueStaffModel } from './queue-staff/queue-staff.entity';

@Entity('queue_model')
export class QueueModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: true })
  createdAt: Date;

  @ManyToOne((type) => CourseModel, (course) => course.queues)
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ nullable: true })
  @Exclude()
  courseId: number;

  @Column('text')
  room: string; // queue name

  @OneToMany((type) => QuestionModel, (qm) => qm.queue)
  @Exclude()
  questions: QuestionModel[];

  @OneToMany((type) => QuestionGroupModel, (qg) => qg.queue)
  @Exclude()
  groups: QuestionGroupModel[];

  @Column('text', { nullable: true })
  notes: string;

  @OneToMany((_type) => QueueStaffModel, (queueStaff) => queueStaff.queue)
  queueStaff: QueueStaffModel[];

  @Column({ default: false })
  allowQuestions: boolean;

  @Column({ type: 'enum', enum: QueueTypes, default: QueueTypes.Hybrid })
  type: QueueTypes;

  @Column('text', { nullable: true })
  zoomLink: string;

  @Column({ default: false })
  isProfessorQueue: boolean;

  @Column({ default: false })
  isDisabled: boolean; // TODO: replace with @deletedAt column

  @OneToMany((type) => QuestionTypeModel, (qtm) => qtm.queue)
  questionTypes: QuestionTypeModel[];

  // I really didn't want to make this a column
  // but typeorm no longer allows you to have a property that is not a column on an entity class.
  // It is a pain in the arse to fix this too,
  // since getQueue first adds on the queueSize with addQueueSize and then returns a QueueModel,
  // which other service functions will take, modify, and then run .save on it.
  // Other endpoints will just return what getQueue returns.
  // Basically, just know that you SHOULD NOT expect queueSize to be up-to-date in the database,
  // and that it's literally only there so that we can have this regular class attribute here.
  @Column({ default: 0 })
  queueSize: number;

  async addQueueSize(): Promise<void> {
    this.queueSize = await QuestionModel.inQueueWithStatus(this.id, [
      ...StatusInQueue,
      OpenQuestionStatus.Helping,
      OpenQuestionStatus.Paused,
    ]).getCount();
  }

  @Column('json', { nullable: true })
  config: QueueConfig;

  @OneToOne((type) => QueueInviteModel, (queueInvite) => queueInvite.queue, {
    cascade: true,
  })
  @Exclude()
  queueInvite: QueueInviteModel;

  @OneToMany(() => QueueChatsModel, (queueChat) => queueChat.queue)
  @Exclude()
  chats: QueueChatsModel[];
}
