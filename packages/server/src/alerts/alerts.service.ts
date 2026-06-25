import {
  Alert,
  AlertPayload,
  AlertType,
  RephraseQuestionPayload,
  PromptStudentToLeaveQueuePayload,
  DocumentProcessedPayload,
  AsyncQuestionUpdatePayload,
  AlertDeliveryMode,
} from '@koh/common';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { Injectable } from '@nestjs/common';
import { QuestionModel } from 'question/question.entity';
import { QueueModel } from '../queue/queue.entity';
import { AlertModel } from './alerts.entity';
import { Brackets, EntityManager } from 'typeorm';

const ALERT_PAYLOAD_CLASS: Partial<Record<AlertType, new () => AlertPayload>> =
  {
    [AlertType.REPHRASE_QUESTION]: RephraseQuestionPayload,
    [AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE]: PromptStudentToLeaveQueuePayload,
    [AlertType.DOCUMENT_PROCESSED]: DocumentProcessedPayload,
    [AlertType.ASYNC_QUESTION_UPDATE]: AsyncQuestionUpdatePayload,
  };

export const formatAlertForFrontend = (alert: AlertModel): Alert => {
  return {
    sentAt: alert.sentAt,
    alertType: alert.alertType,
    payload: alert.payload,
    id: alert.id,
    deliveryMode: alert.deliveryMode,
    readAt: alert.readAt,
    courseId: alert.courseId,
    courseName: alert.course ? alert.course.name : undefined,
  };
};

@Injectable()
export class AlertsService {
  constructor() {}

  /* resolves any alerts that should've been resolved automatically and formats the payload for the frontend */
  async removeStaleAlerts(
    alerts: AlertModel[],
    manager?: EntityManager,
  ): Promise<Alert[]> {
    const nonStaleAlerts: Alert[] = [];

    for (const alert of alerts) {
      switch (alert.alertType) {
        case AlertType.REPHRASE_QUESTION: {
          const payload = alert.payload as RephraseQuestionPayload;
          const question = manager
            ? await manager.findOne(QuestionModel, {
                where: { id: payload.questionId },
              })
            : await QuestionModel.findOne({
                where: { id: payload.questionId },
              });

          const queue = manager
            ? await manager.findOne(QueueModel, {
                where: { id: payload.queueId },
                relations: {
                  queueStaff: true,
                },
              })
            : await QueueModel.findOne({
                where: { id: payload.queueId },
                relations: {
                  queueStaff: true,
                },
              });

          const isQueueOpen =
            queue && queue.queueStaff.length > 0 && !queue.isDisabled;
          if (question?.closedAt || !isQueueOpen) {
            // if the question is done or the queue isn't open anymore, then the alert doesn't matter anymore so we can close it for them
            alert.readAt = new Date();
            if (manager) {
              await manager.save(alert);
            } else {
              await alert.save();
            }
          } else {
            nonStaleAlerts.push(formatAlertForFrontend(alert));
          }
          break;
        }
        case AlertType.EVENT_ENDED_CHECKOUT_STAFF:
        case AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE:
        case AlertType.DOCUMENT_PROCESSED:
        case AlertType.ASYNC_QUESTION_UPDATE:
          nonStaleAlerts.push(formatAlertForFrontend(alert));
          break;
      }
    }

    return nonStaleAlerts;
  }
  assertPayloadType(alertType: AlertType, payload: AlertPayload): boolean {
    const PayloadClass = ALERT_PAYLOAD_CLASS[alertType];
    if (!PayloadClass) return true; // no specific payload class (e.g. EVENT_ENDED_CHECKOUT_STAFF), allow it

    const instance = plainToClass(PayloadClass, payload);
    const errors = validateSync(instance);
    return errors.length === 0;
  }

  async getUnresolvedRephraseQuestionAlert(
    queueId: number,
  ): Promise<AlertModel[]> {
    const alertType = AlertType.REPHRASE_QUESTION;
    return await AlertModel.createQueryBuilder('alert')
      .where('alert.readAt IS NULL')
      .andWhere('alert.alertType = :alertType', { alertType })
      .andWhere("(alert.payload ->> 'queueId')::INTEGER = :queueId ", {
        queueId,
      })
      .getMany();
  }

  /* 
    MODAL alerts
		- ALL unread alerts (limit 20 since when would you ever have more than like 2 tbh. If you are ever getting more than that, then you're probably being spammed)
		- When given no courseId: Fetch alerts ONLY with null courseId
		- When given courseId: Fetch alerts with both null courseId and the courseId
    */
  async getModalAlerts(
    userId: number,
    manager: EntityManager,
    courseId?: number,
  ): Promise<AlertModel[]> {
    const qb = manager
      .createQueryBuilder(AlertModel, 'alert')
      .where('alert.userId = :userId', { userId })
      .andWhere('alert.deliveryMode = :mode', { mode: AlertDeliveryMode.MODAL })
      .andWhere('alert.readAt IS NULL');

    if (courseId && courseId > 0) {
      qb.andWhere(
        new Brackets((tempQb) => {
          tempQb
            .where('alert.courseId = :courseId', { courseId })
            .orWhere('alert.courseId IS NULL');
        }),
      );
    } else {
      qb.andWhere('alert.courseId IS NULL');
    }

    return qb.take(20).orderBy('alert.sentAt', 'DESC').getMany();
  }

  /*
    FEED alerts
		- When given no courseId: Fetch alerts across ALL courses (or null courseId)
		- When given courseId: Fetch alerts with both null courseId and the courseId (same as modal alerts)
    */
  async getFeedAlerts(
    userId: number,
    manager: EntityManager,
    limit: number,
    offset: number,
    status: 'unread' | 'dismissed' | 'all',
    courseId?: number,
  ): Promise<[AlertModel[], number]> {
    const qb = manager
      .createQueryBuilder(AlertModel, 'alert')
      .leftJoinAndSelect(
        // only joining to get course name for FEED alerts (to show what course the alert is from when on /courses page) since it's not needed for MODAL ones
        'alert.course',
        'course',
      )
      .where('alert.userId = :userId', { userId })
      .andWhere('alert.deliveryMode = :mode', { mode: AlertDeliveryMode.FEED });

    if (status === 'unread') {
      qb.andWhere('alert.readAt IS NULL');
    } else if (status === 'dismissed') {
      qb.andWhere('alert.readAt IS NOT NULL');
    }

    if (courseId && courseId > 0) {
      qb.andWhere(
        new Brackets((tempQb) => {
          tempQb
            .where('alert.courseId = :courseId', { courseId })
            .orWhere('alert.courseId IS NULL');
        }),
      );
    } // if no courseId, get alerts across ALL courses or null

    return await qb
      .orderBy('alert.readAt', 'DESC', 'NULLS FIRST')
      .addOrderBy('alert.sentAt', 'DESC')
      .take(Math.min(limit, 300))
      .skip(offset)
      .getManyAndCount();
  }
}
