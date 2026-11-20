import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LmsIntegrationModule } from '../../../lmsIntegration/lmsIntegration.module';
import { EmbeddableQuestionModule } from '../../embeddable-question/embeddable-question.module';
import { CanvasBatchController } from './canvas-batch.controller';
import { CanvasBatchService } from './canvas-batch.service';
import { CanvasBatchRunnerService } from './canvas-batch-runner.service';
import { CanvasBatchConsumer } from './canvas-batch.consumer';
import { CanvasBatchStore } from './canvas-batch.store';
import { CANVAS_BATCH_QUEUE } from './canvas-batch.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: CANVAS_BATCH_QUEUE }),
    LmsIntegrationModule,
    EmbeddableQuestionModule,
  ],
  controllers: [CanvasBatchController],
  providers: [
    CanvasBatchService,
    CanvasBatchRunnerService,
    CanvasBatchConsumer,
    CanvasBatchStore,
  ],
  exports: [CanvasBatchService],
})
export class CanvasBatchModule {}
