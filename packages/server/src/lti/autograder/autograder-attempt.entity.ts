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
import { AutograderAttemptStatus, AutograderQuestionWork } from '@koh/common';
import { AutograderRunModel } from './autograder-run.entity';

/**
 * One eligible Canvas attempt discovered by a run, with its durable
 * per-question work/results.
 *
 * The unique (runId, quizSubmissionId, attemptNumber) triple is the attempt
 * identity: Canvas returns one quiz submission row per attempt when asked for
 * all versions, so the submission id alone is not unique and the attempt number
 * is what distinguishes a student's later tries.
 */
@Entity('autograder_attempt_model')
@Index(
  'IDX_autograder_attempt_identity',
  ['runId', 'quizSubmissionId', 'attemptNumber'],
  { unique: true },
)
export class AutograderAttemptModel extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ type: 'integer', nullable: false })
  runId: number;

  @ManyToOne(() => AutograderRunModel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'runId' })
  run: AutograderRunModel;

  /** Canvas quiz submission id; the identity Canvas writes back to. */
  @Column({ type: 'integer', nullable: false })
  quizSubmissionId: number;

  @Column({ type: 'integer', nullable: false })
  canvasUserId: number;

  /** Canvas attempt number, required by every Classic write. */
  @Column({ type: 'integer', nullable: false })
  attemptNumber: number;

  @Column({
    type: 'enum',
    enum: AutograderAttemptStatus,
    enumName: 'autograder_attempt_status_enum',
    nullable: false,
  })
  status: AutograderAttemptStatus;

  /**
   * False when Canvas did not provide usable submission history. Unreadable
   * attempts are retained so the runner records a staff error instead of
   * treating the attempt as blank.
   */
  @Column({ type: 'boolean', nullable: false, default: false })
  readable: boolean;

  /** Durable per-question work and results. */
  @Column({ type: 'jsonb', nullable: false })
  questions: AutograderQuestionWork[];

  /** Staff-only summary error; never written to Canvas. */
  @Column({ type: 'text', nullable: true })
  error: string | null;
}
