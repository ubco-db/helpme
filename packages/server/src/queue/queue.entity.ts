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
import { ERROR_MESSAGES } from '@koh/common';
import { QueueSessionModel } from 'queueSession/queueSession.entity';
import { StudentTaskProgressModel } from 'studentTaskProgress/studentTaskProgress.entity';

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

  @Column({ default: false })
  isProfessorQueue: boolean;

  @Column({ default: false })
  isDisabled: boolean;

  startTime: Date;
  endTime: Date;

  isOpen: boolean;

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
    this.queueSize = await QuestionModel.waitingInQueue(this.id).getCount();
  }

  @Column('json', { nullable: true })
  config: JSON;

  // when the proffesor selects "start lab 1", it creates a new queueSession and assigns it to the currentQueueSessionId
  // Basically, this is a foreign key to queueSession, but it's also seperate from the many-to-one relationship between queueSession and queue (queue can have many queueSessions)
  @OneToOne(() => QueueSessionModel)
  @JoinColumn({ name: 'currentQueueSessionId' })
  currentQueueSession: QueueSessionModel;

  // this is unused for now unless someone makes a feature that gets all the queueSessions for a queue (for insights maybe), allowing you to do queue.queueSessions
  @OneToMany(() => QueueSessionModel, (qsm) => qsm.queue)
  @Exclude()
  queueSessions: QueueSessionModel[];

  // TODO: eventually figure out how staff get sent to FE as well
}
