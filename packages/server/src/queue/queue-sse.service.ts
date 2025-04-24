import { Role, SSEQueueResponse } from '@koh/common';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueService } from './queue.service';
import { QueueChatService } from 'queueChats/queue-chats.service';
type QueueClientMetadata = { userId: number; role: Role };

const idToRoom = (queueId: number) => `q-${queueId}`;
/**
 * Handle sending queue sse events
 *
 * Exposes the following:
 * - subscribeClient: subscribes someone to a redis room for a particular queue (they will then be subscribed to a particular queueId).
 *   Then, when a 'pub' event to a particular queueId happens in redis, this will take the new data and pump it into res to be sent to the client over a websocket.
 * - updateQuestions/updateQueue/updateQueueChats: get the latest data for this queue and send it to all clients that are subscribed
 *  to the redis room
 */
@Injectable()
export class QueueSSEService {
  constructor(
    private queueService: QueueService,
    private sseService: SSEService<QueueClientMetadata>,
    @Inject(forwardRef(() => QueueChatService))
    private queueChatService: QueueChatService,
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
      await this.sendToRoom(queueId, async ({ role, userId }) => ({
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
      await this.sendToRoom(queueId, async () => ({ queue }));
    }
  });

  updateQueueChats = this.throttleUpdate(async (queueId) => {
    await this.sendToRoom(queueId, async ({ role, userId }) => ({
      queueChats: await this.queueChatService.getMyChats(queueId, role, userId),
    }));
  });

  /* Sends data to all clients in the room */
  private async sendToRoom(
    queueId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueResponse>,
  ) {
    await this.sseService.sendEvent(idToRoom(queueId), data);
  }

  private throttleUpdate(updateFunction: (queueId: number) => Promise<void>) {
    return throttle(
      async (queueId: number) => {
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
