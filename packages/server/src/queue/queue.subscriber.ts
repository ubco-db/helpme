import { QueueSSEService } from './queue-sse.service';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  UpdateEvent,
} from 'typeorm';
import { QueueModel } from './queue.entity';
import { InjectDataSource } from '@nestjs/typeorm';

@EventSubscriber()
export class QueueSubscriber implements EntitySubscriberInterface<QueueModel> {
  private queueSSEService: QueueSSEService;
  constructor(
    @InjectDataSource()
    dataSource: DataSource,
    queueSSEService: QueueSSEService,
  ) {
    this.queueSSEService = queueSSEService;
    dataSource.subscribers.push(this);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  listenTo() {
    return QueueModel;
  }

  async afterUpdate(event: UpdateEvent<QueueModel>): Promise<void> {
    if (event.entity) {
      // Send all listening clients an update
      await this.queueSSEService.updateQueue(event.entity.id);
    }
  }
}
