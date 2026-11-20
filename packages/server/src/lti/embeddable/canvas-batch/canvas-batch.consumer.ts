import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CanvasBatchRunnerService } from './canvas-batch-runner.service';
import {
  CANVAS_BATCH_QUEUE,
  CanvasBatchJobData,
} from './canvas-batch.constants';

/**
 * Single-concurrency worker for the batch backend. Discovery, grading, and the
 * SpeedGrader prefill run one job at a time so a run's durable state and its
 * Canvas writes are never interleaved.
 */
@Processor(CANVAS_BATCH_QUEUE, { concurrency: 1 })
export class CanvasBatchConsumer extends WorkerHost {
  constructor(private readonly runner: CanvasBatchRunnerService) {
    super();
  }

  async process(job: Job<CanvasBatchJobData>): Promise<void> {
    await this.runner.run(job.data.runId);
  }
}
