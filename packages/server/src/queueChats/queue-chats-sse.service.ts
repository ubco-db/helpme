import { Role, SSEQueueChatResponse } from '@koh/common';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Response } from 'express';
import { throttle } from 'lodash';
import { SSEService } from 'sse/sse.service';
import { QueueChatService } from 'queueChats/queue-chats.service';

type QueueClientMetadata = { userId: number; role: Role };

const idToRoom = (queueId: number, questionId: number, staffId: number) =>
  `qc-${queueId}-${questionId}-${staffId}`;
/**
 * Handle sending queue sse events
 */
@Injectable()
export class QueueChatSSEService {
  constructor(
    private sseService: SSEService<QueueClientMetadata>,
    @Inject(forwardRef(() => QueueChatService))
    private queueChatService: QueueChatService,
  ) {}

  subscribeClient(
    queueId: number,
    questionId: number,
    staffId: number,
    res: Response,
    metadata: QueueClientMetadata,
  ): void {
    this.sseService.subscribeClient(
      idToRoom(queueId, questionId, staffId),
      res,
      metadata,
    );
  }

  updateQueueChat = this.throttleUpdate(
    async (queueId, questionId, staffId) => {
      const queueChat = await this.queueChatService.getChatData(
        queueId,
        questionId,
        staffId,
      );
      if (queueChat) {
        this.sendToRoom(queueId, questionId, staffId, async () => ({
          queueChat,
        }));
      }
    },
  );

  private async sendToRoom(
    queueId: number,
    questionId: number,
    staffId: number,
    data: (metadata: QueueClientMetadata) => Promise<SSEQueueChatResponse>,
  ) {
    await this.sseService.sendEvent(
      idToRoom(queueId, questionId, staffId),
      (metadata: QueueClientMetadata) => {
        if (
          !this.queueChatService.checkPermissions(
            queueId,
            questionId,
            staffId,
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
    updateFunction: (
      queueId: number,
      questionId: number,
      staffId: number,
    ) => Promise<void>,
  ) {
    return throttle(
      async (queueId: number, questionId?: number, staffId?: number) => {
        try {
          await updateFunction(queueId, questionId, staffId);
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
