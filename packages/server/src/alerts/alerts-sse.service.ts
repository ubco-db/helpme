import { AlertServerSentEvent, AlertServerSentEventType } from '@koh/common';
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
    console.log(
      `Sending Event to user ${userId}`,
      ((await data()) as any).alerts,
    );
    await this.sseService.sendEvent(idToRoom(userId), data);
  }

  /* If the user is subscribed to server-sent events (they have a HelpMe tab open), call this function with the alert to notify them */
  notifyUserOfNewAlert = async (
    alert: AlertModel | number, // NEEDS .course to get courseName
    manager?: EntityManager,
  ) => {
    if (typeof alert === 'number') {
      alert = manager
        ? await manager.findOne(AlertModel, {
            where: { id: alert },
            relations: { course: true },
          })
        : await AlertModel.findOne({
            where: { id: alert },
            relations: { course: true },
          });
    }
    if (!alert) {
      console.error(`notifyUserOfNewAlert: Alert not found for ID: ${alert}`);
      return;
    }
    if (alert.courseId && !alert.course) {
      console.warn(
        `notifyUserOfNewAlert: alert ${JSON.stringify(alert)} doesn't have course, but was expected to have course to attach courseName. Please consider updating queries. Re-fetching alert with course`,
      );
      alert = await AlertModel.findOne({
        where: { id: alert.id },
        relations: { course: true },
      });
    }

    await this.sendToRoom(alert.userId, async () => ({
      alert: formatAlertForFrontend(alert),
      alertId: alert.id,
      eventType: AlertServerSentEventType.NEW_ALERT,
    }));
  };

  /* Notify given user with given list of updated alerts. `alerts` NEEDS relations: {course : true} otherwise it won't get .courseName */
  notifyUserOfUpdatedAlerts = async (
    alerts: AlertModel[], // NEEDS .course to get courseName
  ) => {
    const userId = alerts[0].userId;
    console.log(`Notifying user ${userId} of alerts:`, alerts);
    if (alerts.some((a) => a.userId !== userId)) {
      console.warn(
        `notifyUserOfUpdatedAlerts: alert ${JSON.stringify(alerts.find((a) => a.userId !== userId))} doesn't have the same userId as alerts[0] (${userId}). Filtering out alerts that don't have this user id`,
      );
      alerts = alerts.filter((a) => a.userId === userId);
    }
    if (alerts.some((a) => !a.course && a.courseId)) {
      console.warn(
        `notifyUserOfUpdatedAlerts: alert ${JSON.stringify(alerts.find((a) => !a.course))} doesn't have course, but was expected to have course. Filtering out alerts that don't have a course`,
      );
      alerts = alerts.filter((a) => !!a.course || a.courseId === null);
    }
    if (alerts.length === 0) return;

    console.log('Sending to room');
    await this.sendToRoom(userId, async () => ({
      alerts: alerts.map((a) => formatAlertForFrontend(a)),
      eventType: AlertServerSentEventType.UPDATE_ALERTS,
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
