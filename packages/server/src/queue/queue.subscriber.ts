import { QueueSSEService } from './queue-sse.service';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  UpdateEvent,
} from 'typeorm';
import { QueueModel } from './queue.entity';

@EventSubscriber()
export class QueueSubscriber implements EntitySubscriberInterface<QueueModel> {
  private queueSSEService: QueueSSEService;
  constructor(dataSource: DataSource, queueSSEService: QueueSSEService) {
    this.queueSSEService = queueSSEService;
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return QueueModel;
  }

  async afterUpdate(event: UpdateEvent<QueueModel>): Promise<void> {
    if (event.entity) {
      // Send all listening clients an update
      await this.queueSSEService.updateQueue(event.entity.id, event.manager);
    }
  }
}
