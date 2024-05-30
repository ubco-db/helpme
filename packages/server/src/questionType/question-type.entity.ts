import {
  BaseEntity,
  Column,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionModel } from '../question/question.entity';
import { Exclude } from 'class-transformer';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { QueueSessionModel } from '../queueSession/queueSession.entity';

@Entity('question_type_model')
export class QuestionTypeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true }) // when null, it's for async question centre
  @ManyToOne(() => QueueSessionModel)
  @JoinColumn({ name: 'qsid' })
  @Exclude() // we exclude this since it's not needed on the frontend
  queueSession: QueueSessionModel;

  @Column({ nullable: true })
  cid: number;

  @Column({ type: 'text', nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true, default: '#000000' })
  color: string;

  @ManyToMany(() => QuestionModel, (question) => question.questionTypes)
  questions: QuestionModel[];

  @ManyToMany(() => AsyncQuestionModel, (question) => question.questionTypes)
  asyncQuestions: AsyncQuestionModel[];

  @Column({ nullable: true })
  queueId: number | null;
}
