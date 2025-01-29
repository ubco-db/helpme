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

  @ManyToOne((type) => CourseModel, (course) => course.queues, {
    onDelete: 'CASCADE',
  })
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

  startTime: Date;
  endTime: Date;

  isOpen: boolean;

  // This seems really weird, since staffList is always going to be >=0, so all queues are always open.
  async checkIsOpen(): Promise<boolean> {
    if (!this.staffList) {
      console.error(ERROR_MESSAGES.queueController.missingStaffList, this.id);
      throw new HttpException(
        ERROR_MESSAGES.queueController.missingStaffList,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    this.isOpen = this.staffList.length >= 0 && !this.isDisabled;
    return this.isOpen;
  }

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
