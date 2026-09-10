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
import { UserModel } from '../../../profile/user.entity';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { GradingSnapshot } from '@koh/common';

@Entity('embeddable_question_feedback_model')
export class EmbeddableQuestionFeedbackModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ type: 'integer', nullable: false })
  courseId: number;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  course: CourseModel;

  @Column({ type: 'integer', nullable: false })
  questionId: number;

  @ManyToOne(() => EmbeddableQuestionModel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'questionId' })
  embeddableQuestion: EmbeddableQuestionModel;

  @Column({ type: 'integer', nullable: false })
  userId: number;

  @ManyToOne(() => UserModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserModel;

  @Column({ type: 'text', nullable: false })
  submission: string;

  @Column({ type: 'text', nullable: false })
  aiFeedback: string;

  @Column({ type: 'double precision', nullable: false })
  aiGrade: number;

  @Column({ type: 'text', array: true, nullable: false, default: [] })
  appliedRequirements: string[];

  @Column({ type: 'text', nullable: true })
  aiModel: string | null;

  @Column({ type: 'double precision', nullable: true })
  maxScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  gradingSnapshot: GradingSnapshot | null;

  @Column({ type: 'text', array: true, nullable: false, default: [] })
  reasons: string[];

  @Column({ type: 'boolean', nullable: false, default: false })
  needsHumanReview: boolean;
}
