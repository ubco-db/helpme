import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModel } from '../../../course/course.entity';
import { Exclude } from 'class-transformer';
import { QuestionGradingSettings } from '@koh/common';

@Entity('embeddable_question_model')
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

  @Column({ type: 'jsonb', nullable: false })
  gradingSettings: QuestionGradingSettings;
}
