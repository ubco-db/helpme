import { Role, SSEQueueChatResponse } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueChatService } from 'queueChats/queue-chats.service';

type QueueClientMetadata = { userId: number; role: Role };

const idToRoom = (queueId: number, questionId: number) =>
  `qc-${queueId}-${questionId}`;
/**
 * Handle sending queue sse events
 */
@Injectable()
export class QueueChatSSEService {
  constructor(
    private sseService: SSEService<QueueClientMetadata>,
    private queueChatService: QueueChatService,
  ) {}

  subscribeClient(
    queueId: number,
    questionId: number,
    res: Response,
    metadata: QueueClientMetadata,
  ): void {
    this.sseService.subscribeClient(
      idToRoom(queueId, questionId),
      res,
      metadata,
    );
  }

  updateQueueChat = this.throttleUpdate(async (queueId, questionId) => {
    const queueChat = await this.queueChatService.getChatData(
      queueId,
      questionId,
    );
    if (queueChat) {
      this.sendToRoom(queueId, questionId, async () => ({ queueChat }));
    }
  });

  private async sendToRoom(
    queueId: number,
    questionId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueChatResponse>,
  ) {
    await this.sseService.sendEvent(
      idToRoom(queueId, questionId),
      (metadata: QueueClientMetadata) => {
        if (
          !this.queueChatService.checkPermissions(
            queueId,
            questionId,
            metadata.userId,
          )
        ) {
          return data(metadata).then((response) => {
            delete response.queueChat; // Remove chat data if user is not allowed to see it
            return response;
          });
        } else {
          return data(metadata);
        }
      },
    );
  }

  private throttleUpdate(
    updateFunction: (queueId: number, questionId: number) => Promise<void>,
  ) {
    return throttle(
      async (queueId: number, questionId?: number) => {
        try {
          await updateFunction(queueId, questionId);
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
