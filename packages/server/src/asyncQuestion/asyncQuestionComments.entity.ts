import { Exclude } from 'class-transformer';
import { UserModel } from '../profile/user.entity';
import {
  AfterLoad,
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AsyncQuestionModel } from './asyncQuestion.entity';

@Entity('async_question_comments_model')
export class AsyncQuestionCommentsModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  commentText: string;

  @Column()
  createdAt: Date;

  @ManyToOne((type) => UserModel, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'creatorId' })
  creator: UserModel;

  @Column({ nullable: false })
  @Exclude()
  creatorId: number;

  @ManyToOne(() => AsyncQuestionModel, (question) => question.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'questionId' })
  question: AsyncQuestionModel;

  @Column({ nullable: false })
  @Exclude()
  questionId: number;
}
