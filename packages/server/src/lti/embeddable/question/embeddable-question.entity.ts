import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CourseModel } from '../../../course/course.entity';
import { Exclude } from 'class-transformer';
import { EmbeddableQuizModel } from '../quiz/embeddable-quiz.entity';
import { QuestionGradingSettings } from '@koh/common';

@Entity('embeddable_question_model')
@Unique(['id', 'courseId'])
export class EmbeddableQuestionModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ type: 'integer', nullable: false })
  courseId: number;

  @Column({ type: 'text', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  questionText: string;

  @Column({ type: 'integer', nullable: true })
  quizId: number | null;

  @ManyToOne(() => EmbeddableQuizModel, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'quizId' })
  quiz: EmbeddableQuizModel | null;

  @Column({ type: 'jsonb', nullable: false })
  gradingSettings: QuestionGradingSettings;
}
