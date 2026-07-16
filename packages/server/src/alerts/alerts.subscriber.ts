import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AlertModel } from './alerts.entity';
import { AlertServerSentEventType } from '@koh/common';
import { AlertsSSEService } from './alerts-sse.service';

@EventSubscriber()
export class AlertsSubscriber implements EntitySubscriberInterface<AlertModel> {
  private alertsSSEService: AlertsSSEService;
  constructor(dataSource: DataSource, alertsSSEService: AlertsSSEService) {
    this.alertsSSEService = alertsSSEService;
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return AlertModel;
  }

  /* So annoying thing with this. I want these subscribers to basically be automatic,
  where any CRUD to an alert will automatically update the frontend without you needing to remember to do
  anything with alerts SSE service. But this might not be possible with typeorm.

  - We have several areas where we run an .update() to mark all read for all alerts of a particular type,
  such as markReadAllFeed runs a .update() query where readAt = null to set readAt = now()
  - this makes it so that event.entity here just becomes { readAt: 2026-07-07T22:24:51.977Z }
  - How am I going to run notifyUserOfUpdatedAlerts() if I don't have a list of what events were updated?
  - Now, I could make sure all AlertModel.update() statements feed in a `userId` field to the SET statement so that 
  event.entity becomes { readAt: 2026-07-07T22:24:51.977Z, userId: 4 } (event.entity is only SET fields),
  that way I can GET all alerts that match this and then send it to notifyUserOfUpdatedAlerts(). But this adds an extra query,
  and more importantly it still requires you to remember to add the `userId` to the SET field to any future query,
  which is about the same as needing to remember to run notifyUserOfUpdatedAlerts for any future query.
  - I believe it's the same scenario with beforeUpdate (tested: yep)
  - I bet I could do it if I had access to the WHERE params but it doesn't seem like it. Maybe there's a way to get the last statement in a transaction?? But that feels fragile
  
  Okay I threw claud opus at it a few times and it gave garbage.
  I'm gonna try fetching all alerts that match the particular timestamp and then group them by user.
  */
  async afterUpdate(event: UpdateEvent<AlertModel>): Promise<void> {
    if (event.entity.id) {
      const updatedAlert = await event.manager.findOne(AlertModel, {
        where: { id: event.entity.id },
        relations: { course: true },
      });
      await this.alertsSSEService.notifyUserOfUpdatedAlerts([updatedAlert]);
    } else if (event.entity.readAt) {
      const alerts = await event.manager.find(AlertModel, {
        relations: { course: true },
        where: {
          readAt: event.entity.readAt, // it's kinda fragile, but what can ya do
        },
      });
      if (!alerts || alerts.length === 0) {
        console.warn(
          'afterUpdate in alerts.subscriber: could not find any alerts that match the readAt timestamp: ',
          event.entity.readAt,
          '. User not updated of alerts.',
        );
        return;
      }
      // group by user
      const alertsByUser = alerts.reduce(
        (acc, alert) => {
          acc[alert.userId] = acc[alert.userId] || [];
          acc[alert.userId].push(alert);
          return acc;
        },
        {} as Record<number, AlertModel[]>,
      );

      for (const alerts of Object.values(alertsByUser)) {
        await this.alertsSSEService.notifyUserOfUpdatedAlerts(alerts);
      }
    } else {
      console.warn(
        'afterUpdate in alerts.subscriber: Event does not have alert.id or readAt. Please make sure the query includes it so it can be included here (otherwise user does not get notified of updated alert). Event entity:',
        event.entity,
      );
    }
  }

  // Important: remember that all of these event subscriber methods run IN A TRANSACTION and thus all queries you perform in them must also be in the transaction to have the updated data
  async afterInsert(event: InsertEvent<AlertModel>): Promise<void> {
    if (!event.entity.id) {
      console.warn(
        "afterInsert in alerts.subscriber: Event does not have alert.id. Idk why this is, maybe a bulk insert for some reason didn't include it? Event.entity:",
        event.entity,
      );
    } else {
      await this.alertsSSEService.notifyUserOfNewAlert(
        event.entity.id,
        event.manager,
      ); // event.entity lacks `.course` relation so we need to give it the alert id with the manager to re-query it
    }
  }

  async afterRemove(event: RemoveEvent<AlertModel>): Promise<void> {
    if (event.entity?.userId && event.entityId) {
      await this.alertsSSEService.notifyUserOfDeletedAlert(
        event.entityId,
        event.entity.userId,
      );
    } else {
      console.warn(
        'afterRemove in alerts.subscriber: Event entity is missing userId or entityId. User was not updated of their deleted alert. Event entity:',
        event.entity,
        ' event.entityId',
        event.entityId,
      );
    }
  }
}
