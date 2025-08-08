import {
  QuestionLocations,
  QuestionStatus,
  Role,
  StatusInQueue,
} from '@koh/common';
import { Exclude } from 'class-transformer';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  SelectQueryBuilder,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { QueueModel } from '../queue/queue.entity';
import { canChangeQuestionStatus } from './question-fsm';
import { QuestionGroupModel } from './question-group.entity';
import { QuestionTypeModel } from '../questionType/question-type.entity';

@Entity('question_model')
export class QuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => QueueModel, (q) => q.questions)
  @JoinColumn({ name: 'queueId' })
  @Exclude()
  queue: QueueModel;

  @Column({ nullable: true })
  @Exclude()
  queueId: number;

  @Column('text')
  text: string;

  @ManyToOne((type) => UserModel)
  @JoinColumn({ name: 'creatorId' })
  creator: UserModel;

  @Column({ nullable: true })
  @Exclude()
  creatorId: number;

  @ManyToOne((type) => UserModel)
  @JoinColumn({ name: 'taHelpedId' })
  taHelped: UserModel;

  @Column({ nullable: true })
  @Exclude()
  taHelpedId: number;

  @Column()
  createdAt: Date;

  // When the question was first helped (doesn't overwrite) - probably don't need anymore (other than if we want to compare if a question has been helped multiple times by seeing if helpedAt == firstHelpedAt)
  @Column({ nullable: true })
  @Exclude()
  firstHelpedAt: Date;

  // ready questions are questions that can be helped (i.e. queued or paused questions)
  @Column({ nullable: true })
  lastReadyAt: Date;

  // Stores how long the question has been waiting for help.
  // Only gets set on status change, so it will be fine to display this for done questions (e.g. in insights),
  // but for questions currently in the queue, you need to calculate the actual wait time as waitTime + (now - lastReadyAt)
  @Column('integer', { default: 0 })
  waitTime: number; // in seconds

  // When the question was last helped (getting help again overwrites) - alterative name is lastHelpedAt
  @Column({ nullable: true })
  helpedAt: Date;

  // Stores how long the question has been helped for (since just doing closedAt - helpedAt is not accurate as a question can be helped multiple times)
  // Only gets set on status change, so it will be fine to display this for done questions (e.g. in insights),
  // but for questions currently in the queue, you need to calculate the actual help time as helpTime + (now - helpedAt)
  @Column('integer', { default: 0 })
  helpTime: number; // in seconds

  // When the question leaves the queue
  @Column({ nullable: true })
  closedAt: Date;

  @Column('text')
  status: QuestionStatus;

  @Column({
    type: 'enum',
    enum: QuestionLocations,
    default: QuestionLocations.Unselected,
  })
  location: QuestionLocations;

  @Column()
  groupable: boolean;

  @Column({ type: 'boolean', default: false })
  isTaskQuestion: boolean;

  @ManyToOne((type) => QuestionGroupModel, { nullable: true })
  @JoinColumn({ name: 'groupId' })
  group: QuestionGroupModel;

  @Column({ nullable: true })
  @Exclude()
  groupId: number;

  @ManyToMany(() => QuestionTypeModel, { eager: true })
  @JoinTable({
    name: 'question_question_type_model',
    joinColumn: { name: 'questionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'questionTypeId', referencedColumnName: 'id' },
  })
  questionTypes: QuestionTypeModel[];
  question: { id: number; name: string; photoURL: string };

  /**
   * Change the status of the question as the given role
   *
   * @returns whether status change succeeded
   */
  public changeStatus(newStatus: QuestionStatus, role: Role): boolean {
    if (canChangeQuestionStatus(this.status, newStatus, role)) {
      this.status = newStatus;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Scopes
   */
  static inQueueWithStatus(
    queueId: number,
    statuses: QuestionStatus[],
    limit = 100,
  ): SelectQueryBuilder<QuestionModel> {
    return this.createQueryBuilder('question')
      .where('question.queueId = :queueId', { queueId })
      .andWhere('question.status IN (:...statuses)', { statuses })
      .limit(limit)
      .orderBy('question.createdAt', 'ASC');
  }

  /**
   * Questions that are open in the queue (not in priority queue)
   */
  static waitingInQueue(queueId: number): SelectQueryBuilder<QuestionModel> {
    return QuestionModel.inQueueWithStatus(queueId, StatusInQueue);
  }
}
