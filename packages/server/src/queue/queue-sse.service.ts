import { Role, SSEQueueResponse } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueService } from './queue.service';

type QueueClientMetadata = { userId: number; role: Role };

const idToRoom = (queueId: number) => `q-${queueId}`;
/**
 * Handle sending queue sse events
 */
@Injectable()
export class QueueSSEService {
  constructor(
    private queueService: QueueService,
    private sseService: SSEService<QueueClientMetadata>,
  ) {}

  subscribeClient(
    queueId: number,
    res: Response,
    metadata: QueueClientMetadata,
  ): void {
    this.sseService.subscribeClient(idToRoom(queueId), res, metadata);
  }

  // Send event with new questions, but no more than once a second
  updateQuestions = this.throttleUpdate(async (queueId) => {
    const queueQuestions = await this.queueService.getQuestions(queueId);
    if (queueQuestions) {
      this.sendToRoom(queueId, async ({ role, userId }) => ({
        queueQuestions: await this.queueService.personalizeQuestions(
          queueId,
          queueQuestions,
          userId,
          role,
        ),
      }));
    }
  });

  updateQueue = this.throttleUpdate(async (queueId) => {
    const queue = await this.queueService.getQueue(queueId);
    if (queue) {
      this.sendToRoom(queueId, async () => ({ queue }));
    }
  });

  private async sendToRoom(
    queueId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueResponse>,
  ) {
    await this.sseService.sendEvent(
      idToRoom(queueId),
      (metadata: QueueClientMetadata) => {
        return data(metadata);
      },
    );
  }

  private throttleUpdate(
    updateFunction: (queueId: number, studentId?: number) => Promise<void>,
  ) {
    return throttle(
      async (queueId: number, studentId?: number) => {
        try {
          await updateFunction(queueId);
        } catch (e) {}
      },
      1000,
      {
        leading: false,
        trailing: true,
      },
    );
  }
}
