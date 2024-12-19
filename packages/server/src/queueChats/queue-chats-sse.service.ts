import { Role, SSEQueueChatResponse } from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueChatService } from 'queueChats/queue-chats.service';

type QueueClientMetadata = { userId: number; role: Role };

const idToRoom = (queueId: number, studentId: number) =>
  `qc-${queueId}-${studentId}`;
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
    studentId: number,
    res: Response,
    metadata: QueueClientMetadata,
  ): void {
    this.sseService.subscribeClient(
      idToRoom(queueId, studentId),
      res,
      metadata,
    );
  }

  updateQueueChat = this.throttleUpdate(async (queueId, studentId) => {
    const queueChat = await this.queueChatService.getChatData(
      queueId,
      studentId,
    );
    if (queueChat) {
      this.sendToRoom(queueId, studentId, async () => ({ queueChat }));
    }
  });

  private async sendToRoom(
    queueId: number,
    studentId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueChatResponse>,
  ) {
    await this.sseService.sendEvent(
      idToRoom(queueId, studentId),
      (metadata: QueueClientMetadata) => {
        if (
          !this.queueChatService.checkPermissions(
            queueId,
            studentId,
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
    updateFunction: (queueId: number, studentId: number) => Promise<void>,
  ) {
    return throttle(
      async (queueId: number, studentId?: number) => {
        try {
          await updateFunction(queueId, studentId);
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
