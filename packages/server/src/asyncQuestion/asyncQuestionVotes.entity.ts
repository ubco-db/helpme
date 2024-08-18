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

@Entity('async_question_votes_model')
export class AsyncQuestionVotesModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne((type) => UserModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Column({ nullable: false })
  @Exclude()
  userId: number;

  @ManyToOne((type) => AsyncQuestionModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'questionId' })
  question: AsyncQuestionModel;

  @Column({ nullable: false })
  @Exclude()
  questionId: number;

  @Column({ nullable: false })
  vote: number;
}
