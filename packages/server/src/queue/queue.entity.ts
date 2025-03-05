import { Exclude } from 'class-transformer';
import { QuestionGroupModel } from '../question/question-group.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../course/course.entity';
import { UserModel } from '../profile/user.entity';
import { QuestionModel } from '../question/question.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  ERROR_MESSAGES,
  OpenQuestionStatus,
  QueueConfig,
  QueueTypes,
  StatusInQueue,
} from '@koh/common';
import { QuestionTypeModel } from '../questionType/question-type.entity';
import { QueueInviteModel } from './queue-invite.entity';

@Entity('queue_model')
export class QueueModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => CourseModel, (course) => course.queues)
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ nullable: true })
  @Exclude()
  courseId: number;

  @Column('text')
  room: string;

  @OneToMany((type) => QuestionModel, (qm) => qm.queue)
  @Exclude()
  questions: QuestionModel[];

  @OneToMany((type) => QuestionGroupModel, (qg) => qg.queue)
  @Exclude()
  groups: QuestionGroupModel[];

  @Column('text', { nullable: true })
  notes: string;

  @ManyToMany((type) => UserModel, (user) => user.queues)
  @JoinTable()
  staffList: UserModel[];

  @Column({ default: false })
  allowQuestions: boolean;

  @Column({ default: 'hybrid' })
  type: QueueTypes;

  @Column('text', { nullable: true })
  zoomLink: string;

  @Column({ default: false })
  isProfessorQueue: boolean;

  @Column({ default: false })
  isDisabled: boolean;

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
}
