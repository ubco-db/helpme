import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AutograderRunnerService } from './autograder-runner.service';
import { AUTOGRADER_QUEUE_NAME, AutograderJobData } from '@koh/common';

/**
 * Single-concurrency worker for the autograder. Only one run is processed at a
 * time, which keeps Canvas load predictable. The per-run advisory lock in
 * `AutograderStore` is what actually prevents two deliveries of the same job
 * from interleaving writes, so concurrency could be raised later without
 * weakening that guarantee.
 */
@Processor(AUTOGRADER_QUEUE_NAME, { concurrency: 1 })
export class AutograderConsumer extends WorkerHost {
  constructor(private readonly runner: AutograderRunnerService) {
    super();
  }

  async process(job: Job<AutograderJobData>): Promise<void> {
    await this.runner.run(job.data.runId);
  }
}
