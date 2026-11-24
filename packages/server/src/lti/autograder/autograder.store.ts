import { Injectable, Logger } from '@nestjs/common';
import { AutograderRunStatus } from '@koh/common';
import { AutograderRunModel } from './autograder-run.entity';
import { AutograderAttemptModel } from './autograder-attempt.entity';

/**
 * Arbitrary but stable key for the PostgreSQL advisory lock namespace. The
 * second lock key is the run id, so locks are scoped to one autograder run.
 * Keep this value stable across deploys; changing it would let an old worker
 * and a new worker process the same run at the same time.
 */
const RUN_LOCK_NAMESPACE = 1789763948;

/**
 * The only persistence the autograder needs. It is a thin, concrete data access
 * helper over the two autograder tables. It owns the one place a real database
 * guarantee matters: claiming the single active run for a course + quiz.
 */
@Injectable()
export class AutograderStore {
  private readonly logger = new Logger(AutograderStore.name);

  /**
   * A BullMQ job can be redelivered while its original worker is still alive.
   * The advisory lock is held by the original worker's database connection, so
   * the duplicate job exits without doing anything. That is intentional: the
   * original worker continues processing, and the duplicate must not interleave
   * its Canvas writes.
   */
  async withRunLock(runId: number, work: () => Promise<void>): Promise<void> {
    // One database connection is held for the duration of an active run.
    const connection =
      AutograderRunModel.getRepository().manager.connection.createQueryRunner();
    let locked = false;
    try {
      const rows: { locked: boolean }[] = await connection.query(
        'SELECT pg_try_advisory_lock($1::int, $2::int) AS locked',
        [RUN_LOCK_NAMESPACE, runId],
      );
      locked = rows[0].locked;
      if (locked) {
        await work();
      } else {
        this.logger.warn(
          `Autograder run ${runId} is already being processed by another worker; skipping the duplicate job.`,
        );
      }
    } finally {
      try {
        if (locked) {
          await connection.query(
            'SELECT pg_advisory_unlock($1::int, $2::int)',
            [RUN_LOCK_NAMESPACE, runId],
          );
        }
      } finally {
        await connection.release();
      }
    }
  }

  async findActiveRun(
    courseId: number,
    canvasQuizId: number,
  ): Promise<AutograderRunModel | null> {
    return AutograderRunModel.findOne({
      where: { courseId, canvasQuizId, status: AutograderRunStatus.Running },
    });
  }

  /**
   * Claims the single running run for a course + quiz.
   *
   * The partial unique index is the real guard. The pre-check keeps the common
   * case cheap; a unique violation from a concurrent starter is resolved to the
   * winner in a fresh query. Any other database error is re-thrown.
   */
  async createActiveRun(
    data: Partial<AutograderRunModel>,
  ): Promise<AutograderRunModel> {
    if (data.courseId === undefined || data.canvasQuizId === undefined) {
      throw new Error('A run needs a courseId and canvasQuizId.');
    }
    const existing = await this.findActiveRun(data.courseId, data.canvasQuizId);
    if (existing) {
      this.logger.log(
        `Resuming active autograder run ${existing.id} for course ${data.courseId}, Canvas quiz ${data.canvasQuizId}.`,
      );
      return existing;
    }
    try {
      const repository = AutograderRunModel.getRepository();
      const run = repository.create(data);
      await repository.save(run);
      this.logger.log(
        `Created autograder run ${run.id} for course ${data.courseId}, Canvas quiz ${data.canvasQuizId}.`,
      );
      return run;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const winner = await this.findActiveRun(data.courseId, data.canvasQuizId);
      if (!winner) {
        throw error;
      }
      this.logger.log(
        `Another worker created autograder run ${winner.id}; resuming it.`,
      );
      return winner;
    }
  }

  async findRun(runId: number): Promise<AutograderRunModel | null> {
    return AutograderRunModel.findOne({ where: { id: runId } });
  }

  async listRuns(courseId: number): Promise<AutograderRunModel[]> {
    return AutograderRunModel.find({
      where: { courseId },
      order: { id: 'DESC' },
    });
  }

  async saveRun(run: AutograderRunModel): Promise<AutograderRunModel> {
    return run.save();
  }

  async listAttempts(runId: number): Promise<AutograderAttemptModel[]> {
    return AutograderAttemptModel.find({
      where: { runId },
      order: { id: 'ASC' },
    });
  }

  async findAttempt(
    runId: number,
    quizSubmissionId: number,
    attemptNumber: number,
  ): Promise<AutograderAttemptModel | null> {
    return AutograderAttemptModel.findOne({
      where: { runId, quizSubmissionId, attemptNumber },
    });
  }

  async createAttempt(
    data: Partial<AutograderAttemptModel>,
  ): Promise<AutograderAttemptModel> {
    const repository = AutograderAttemptModel.getRepository();
    const attempt = repository.create(data);
    await repository.save(attempt);
    return attempt;
  }

  async saveAttempt(
    attempt: AutograderAttemptModel,
  ): Promise<AutograderAttemptModel> {
    return attempt.save();
  }
}

/** Postgres unique-violation code (23505). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  return candidate.code === '23505' || candidate.driverError?.code === '23505';
}
