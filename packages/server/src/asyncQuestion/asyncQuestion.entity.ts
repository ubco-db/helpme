//got rid of questiontype
import { asyncQuestionStatus } from '@koh/common';
import { Exclude } from 'class-transformer';
import { CourseModel } from '../course/course.entity';
import {
  AfterLoad,
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { AsyncQuestionVotesModel } from './asyncQuestionVotes.entity';
import { QuestionTypeModel } from '../questionType/question-type.entity';
import { AsyncQuestionCommentModel } from './asyncQuestionComment.entity';
import { UnreadAsyncQuestionModel } from './unread-async-question.entity';

@Entity('async_question_model')
export class AsyncQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => CourseModel)
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ nullable: true })
  @Exclude()
  courseId: number;

  @Column('text')
  questionAbstract: string;

  @Column('text', { nullable: true })
  questionText: string;

  @Column('text', { nullable: true })
  aiAnswerText: string;

  @Column('text', { nullable: true })
  answerText: string;

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

  @Column({ nullable: true })
  closedAt: Date;

  @ManyToMany(() => QuestionTypeModel, { eager: true })
  @JoinTable({
    name: 'async_question_question_type_model',
    joinColumn: { name: 'questionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'questionTypeId', referencedColumnName: 'id' },
  })
  questionTypes: QuestionTypeModel[];

  @Column('text')
  status: asyncQuestionStatus;

  @Column('boolean', { default: false })
  authorSetVisible: boolean;

  @Column('boolean', { nullable: true })
  staffSetVisible: boolean;

  @Column('boolean', { default: true })
  isAnonymous: boolean;

  @Column('boolean')
  verified: boolean;

  @OneToMany(() => AsyncQuestionVotesModel, (vote) => vote.question, {
    eager: true,
  })
  votes: AsyncQuestionVotesModel[];

  @OneToMany(() => AsyncQuestionCommentModel, (comment) => comment.question)
  comments: AsyncQuestionCommentModel[];

  votesSum: number;

  @OneToMany(() => UnreadAsyncQuestionModel, (ucm) => ucm.asyncQuestion)
  viewers: UnreadAsyncQuestionModel[];

  @AfterLoad()
  sumVotes() {
    this.votesSum = this.votes.reduce((acc, vote) => acc + vote.vote, 0);
  }
}
