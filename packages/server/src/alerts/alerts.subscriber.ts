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

  async afterUpdate(event: UpdateEvent<AlertModel>): Promise<void> {
    if (event.entity.id) {
      await this.alertsSSEService.notifyUserOfNewAlert(
        event.entity.id,
        AlertServerSentEventType.MARK_READ,
        event.manager,
      );
    } else {
      console.warn(
        'afterUpdate in alerts.subscriber: Event does not have alert.id. Please make sure the query includes it so it can be included here (otherwise user does not get notified of updated alert). Event entity:',
        event.entity,
      );
    }
  }

  // Important: remember that all of these event subscriber methods run IN A TRANSACTION and thus all queries you perform in them must also be in the transaction to have the updated data
  async afterInsert(event: InsertEvent<AlertModel>): Promise<void> {
    await this.alertsSSEService.notifyUserOfNewAlert(
      event.entity.id,
      AlertServerSentEventType.NEW_ALERT,
      event.manager,
    ); // event.entity lacks `.course` relation so we need to give it the alert id with the manager to re-query it
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
