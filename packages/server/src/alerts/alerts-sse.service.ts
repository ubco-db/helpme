import {
  Alert,
  AlertServerSentEvent,
  AlertServerSentEventType,
} from '@koh/common';
import { Injectable } from '@nestjs/common';

import { AlertModel } from './alerts.entity';
import { SSEService } from '../sse/sse.service';
import { Response } from 'express';
import { formatAlertForFrontend } from './alerts.service';
import { EntityManager } from 'typeorm';

const idToRoom = (userId: number) => `uid-${userId}`;
type AlertClientMetadata = {
  userId: number; // not actually used but maybe i'll leave it here in case it does
};

@Injectable()
export class AlertsSSEService {
  constructor(private sseService: SSEService<AlertClientMetadata>) {}

  subscribeClientToSSE(userId: number, res: Response): void {
    this.sseService.subscribeClient(idToRoom(userId), res, { userId });
  }

  /* Sends data to all clients in the room */
  private async sendToRoom(
    userId: number,
    data: () => Promise<AlertServerSentEvent>,
  ) {
    await this.sseService.sendEvent(idToRoom(userId), data);
  }

  /* If the user is subscribed to server-sent events (they have a HelpMe tab open), call this function with the alert to notify them */
  notifyUserOfNewAlert = async (
    alert: AlertModel | number, // NEEDS .course to get courseName
    eventType: AlertServerSentEventType = AlertServerSentEventType.NEW_ALERT,
    manager?: EntityManager,
  ) => {
    if (typeof alert === 'number') {
      alert = manager
        ? await manager.getRepository(AlertModel).findOne({
            where: { id: alert },
            relations: { course: true },
          })
        : await AlertModel.findOne({
            where: { id: alert },
            relations: { course: true },
          });
    }
    if (!alert) {
      console.error(`Alert not found for ID: ${alert}`);
      return;
    }

    await this.sendToRoom(alert.userId, async () => ({
      alert: formatAlertForFrontend(alert),
      alertId: alert.id,
      eventType,
    }));
  };

  // There isn't really any case right now where an alert is deleted other than when an admin deletes an admin-alert
  notifyUserOfDeletedAlert = async (alertId: number, userId: number) => {
    await this.sendToRoom(userId, async () => ({
      alertId: alertId,
      eventType: AlertServerSentEventType.DELETE_ALERT,
    }));
  };
}
