import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LmsIntegrationModule } from '../../lmsIntegration/lmsIntegration.module';
import { EmbeddableQuestionModule } from '../embeddable-question/embeddable-question.module';
import { AutograderController } from './autograder.controller';
import { AutograderService } from './autograder.service';
import { AutograderRunnerService } from './autograder-runner.service';
import { AutograderConsumer } from './autograder.consumer';
import { AutograderStore } from './autograder.store';
import { AUTOGRADER_QUEUE_NAME } from '@koh/common';

@Module({
  imports: [
    BullModule.registerQueue({ name: AUTOGRADER_QUEUE_NAME }),
    LmsIntegrationModule,
    EmbeddableQuestionModule,
  ],
  controllers: [AutograderController],
  providers: [
    AutograderService,
    AutograderRunnerService,
    AutograderConsumer,
    AutograderStore,
  ],
  exports: [AutograderService],
})
export class AutograderModule {}
