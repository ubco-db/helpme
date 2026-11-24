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
  AutograderGradingMode,
  AutograderQuestionSnapshot,
  AutograderRunStatus,
} from '@koh/common';
import { CourseModel } from '../../course/course.entity';

/**
 * A durable autograder run. The quiz/assignment catalog, the explicit question
 * mapping (with its frozen rubric/scale), and the fixed final-mode instruction
 * are all frozen at creation so a later question edit never changes what a run
 * grades.
 *
 * The partial unique index on (courseId, canvasQuizId) where status is running
 * is what enforces one active run per course + Canvas quiz. The index is the
 * real guard; a concurrent starter loses the insert and resumes the winner.
 */
@Entity('autograder_run_model')
@Index('IDX_autograder_run_active', ['courseId', 'canvasQuizId'], {
  unique: true,
  where: `"status" = 'running'`,
})
export class AutograderRunModel extends BaseEntity {
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
  quizTitle: string;

  @Column({
    type: 'enum',
    enum: AutograderRunStatus,
    enumName: 'autograder_run_status_enum',
    nullable: false,
  })
  status: AutograderRunStatus;

  @Column({
    type: 'enum',
    enum: AutograderGradingMode,
    enumName: 'autograder_grading_mode_enum',
    nullable: false,
  })
  gradingMode: AutograderGradingMode;

  @Column({ type: 'text', nullable: false })
  instruction: string;

  @Column({ type: 'text', nullable: false })
  speedGraderUrl: string;

  @Column({ type: 'integer', nullable: false })
  createdByUserId: number;

  /** Regrade questions that already have a Canvas score or comment. */
  @Column({ type: 'boolean', nullable: false, default: false })
  regradeSubmissions: boolean;

  /** Also regrade attempts whose grades were already posted to students. */
  @Column({ type: 'boolean', nullable: false, default: false })
  includePostedGrades: boolean;

  /**
   * Frozen question snapshots for this run. This is intentionally JSONB: it is
   * an immutable historical record of what the run graded, so adding fields to
   * the snapshot type does not affect old runs.
   */
  @Column({ type: 'jsonb', nullable: false })
  questionSnapshots: AutograderQuestionSnapshot[];

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
