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
import { QueueModel } from '../queue/queue.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';

@Entity('question_type_model')
export class QuestionTypeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

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

  @ManyToOne((type) => QueueModel, (q) => q.questions)
  @JoinColumn({ name: 'queueId' })
  @Exclude()
  queue: QueueModel;

  @Column({ nullable: true })
  queueId: number | null;
}
