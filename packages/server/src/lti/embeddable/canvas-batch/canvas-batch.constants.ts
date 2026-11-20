/** BullMQ queue and job shape for the Classic Canvas batch backend. */
export const CANVAS_BATCH_QUEUE = 'canvas-batch-grading';

export interface CanvasBatchJobData {
  runId: number;
}

/** Deterministic job id so repeated starts of the same run never duplicate. */
export function canvasBatchJobId(runId: number): string {
  return `canvas-batch-run-${runId}`;
}
