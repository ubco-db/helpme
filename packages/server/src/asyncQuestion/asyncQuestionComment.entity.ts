import { Exclude } from 'class-transformer';
import { UserModel } from '../profile/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AsyncQuestionModel } from './asyncQuestion.entity';

@Entity('async_question_comment_model')
export class AsyncQuestionCommentModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  commentText: string;

  @Column()
  createdAt: Date;

  @ManyToOne((type) => UserModel, (user) => user.asyncQuestionComments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creatorId' })
  @Exclude()
  creator: UserModel;

  @Column()
  creatorId: number;

  @ManyToOne(() => AsyncQuestionModel, (question) => question.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question: AsyncQuestionModel;

  @Column()
  @Exclude()
  questionId: number;
}
