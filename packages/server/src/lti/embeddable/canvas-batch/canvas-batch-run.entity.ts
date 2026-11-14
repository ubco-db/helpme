import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import {
  CanvasBatchGradingMode,
  CanvasBatchQuestionSnapshot,
  CanvasBatchRunStatus,
} from '@koh/common';
import { CourseModel } from '../../../course/course.entity';

/**
 * A durable Classic Canvas batch grading run. The quiz/assignment catalog, the
 * explicit question mapping (with its frozen rubric/scale), and the fixed
 * final-mode instruction are all frozen at creation so a later question edit
 * never changes what a run grades.
 *
 * The partial unique index on (courseId, canvasQuizId) where status is running
 * is what enforces one active run per course + Canvas integration + quiz (the
 * Canvas integration is 1:1 with the course). The index is the real guard; a
 * concurrent starter loses the insert and resumes the winner.
 */
@Entity('canvas_batch_run_model')
@Index('IDX_canvas_batch_run_active', ['courseId', 'canvasQuizId'], {
  unique: true,
  where: `"status" = 'running'`,
})
export class CanvasBatchRunModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ type: 'integer', nullable: false })
  courseId: number;

  @ManyToOne(() => CourseModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'courseId' })
  @Exclude()
  course: CourseModel;

  @Column({ type: 'integer', nullable: false })
  canvasQuizId: number;

  /** Canvas assignment id; attempts and comments are addressed through it. */
  @Column({ type: 'integer', nullable: false })
  assignmentId: number;

  @Column({ type: 'text', nullable: false })
  canvasQuizTitle: string;

  @Column({ type: 'text', nullable: false })
  status: CanvasBatchRunStatus;

  @Column({ type: 'text', nullable: false })
  gradingMode: CanvasBatchGradingMode;

  @Column({ type: 'text', nullable: false })
  instruction: string;

  @Column({ type: 'text', nullable: false })
  speedGraderUrl: string;

  @Column({ type: 'integer', nullable: false })
  createdByUserId: number;

  @Column({ type: 'jsonb', nullable: false })
  questions: CanvasBatchQuestionSnapshot[];

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
