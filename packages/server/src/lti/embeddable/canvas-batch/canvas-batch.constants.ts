/** BullMQ queue and job shape for the Classic Canvas batch backend. */
export const CANVAS_BATCH_QUEUE = 'canvas-batch-grading';

/**
 * There is a single job kind. It discovers, grades, and prefills a run; HelpMe
 * never posts or releases grades, so there is no separate post job.
 */
export const CANVAS_BATCH_JOB = 'run';

export interface CanvasBatchJobData {
  runId: number;
}

/** Deterministic job id so repeated starts of the same run never duplicate. */
export function canvasBatchJobId(runId: number): string {
  return `canvas-batch-run-${runId}`;
}
