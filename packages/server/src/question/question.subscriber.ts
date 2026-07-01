import { ClosedQuestionStatus, StatusInQueue } from '@koh/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import {
  NotificationService,
  NotifMsgs,
} from '../notification/notification.service';
import { QueueSSEService } from '../queue/queue-sse.service';
import { QuestionModel } from './question.entity';
import { QueueStaffModel } from 'queue/queue-staff/queue-staff.entity';

@EventSubscriber()
export class QuestionSubscriber
  implements EntitySubscriberInterface<QuestionModel>
{
  private notifService: NotificationService;
  private queueSSEService: QueueSSEService;
  constructor(
    dataSource: DataSource,
    notifService: NotificationService,
    queueSSEService: QueueSSEService,
  ) {
    this.notifService = notifService;
    this.queueSSEService = queueSSEService;
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return QuestionModel;
  }

  async afterUpdate(event: UpdateEvent<QuestionModel>): Promise<void> {
    if (!event.entity || !event.entity.queueId) {
      console.error(
        "WARNING in afterUpdate in question.subscriber.ts: There exists a .update() query somewhere that does not pass enough information (queueId) so users won't be notified of a queue update",
      );
      return;
    }

    await this.queueSSEService.updateQuestions(
      event.entity.queueId,
      event.manager,
    );
    // Send push notification to students when they are hit 3rd in line
    // if status updated to closed
    if (
      event.updatedColumns.find((c) => c.propertyName === 'status') &&
      event.entity.status in ClosedQuestionStatus
    ) {
      // get 3rd in queue before and after this update
      const previousThird = await QuestionModel.waitingInQueue(
        event.entity.queueId,
      )
        .offset(2)
        .getOne();
      const third = await QuestionModel.waitingInQueue(event.entity.queueId)
        .setQueryRunner(event.queryRunner) // Run in same transaction as the update
        .offset(2)
        .getOne();
      if (third && previousThird?.id !== third?.id) {
        const { creatorId } = third;
        this.notifService.notifyUser(creatorId, NotifMsgs.queue.THIRD_PLACE);
      }
    }
  }

  async afterInsert(event: InsertEvent<QuestionModel>): Promise<void> {
    const numberOfQuestions = await event.manager
      .getRepository(QuestionModel)
      .createQueryBuilder('question')
      .where('question.queueId = :queueId', {
        queueId: event.entity.queueId,
      })
      .andWhere('question.status IN (:...statuses)', {
        statuses: StatusInQueue,
      })
      .getCount();

    if (numberOfQuestions === 0) {
      const queueStaff = await event.manager
        .getRepository(QueueStaffModel)
        .find({
          where: {
            queueId: event.entity.queueId,
          },
        });

      queueStaff.forEach((staff) => {
        this.notifService.notifyUser(
          staff.userId,
          NotifMsgs.ta.STUDENT_JOINED_EMPTY_QUEUE,
        );
      });
    }

    // Send all listening clients an update
    await this.queueSSEService.updateQuestions(
      event.entity.queueId,
      event.manager,
    );
  }

  async beforeRemove(event: RemoveEvent<QuestionModel>): Promise<void> {
    // due to cascades entity is not guaranteed to be loaded
    if (event.entity) {
      // Send all listening clients an update
      await this.queueSSEService.updateQuestions(
        event.entity.queueId,
        event.manager,
      );
    }
  }
}
