import {
  BaseEntity,
  Column,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionModel } from '../question/question.entity';
import { Exclude } from 'class-transformer';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { CourseModel } from '../course/course.entity';
import { QueueModel } from '../queue/queue.entity';

@Entity('question_type_model')
export class QuestionTypeModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // since queueId is nullable, we need the courseId to find the question types for the async question centre
  @ManyToOne(() => CourseModel, (course) => course.questionTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cid' })
  @Exclude()
  course: CourseModel;

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

  @ManyToOne(() => QueueModel, (q) => q.questions)
  @JoinColumn({ name: 'queueId' })
  @Exclude()
  queue: QueueModel;

  @Column({ nullable: true }) // when null, it's for async question centre
  queueId: number | null;

  @DeleteDateColumn()
  deletedAt: Date;
}
