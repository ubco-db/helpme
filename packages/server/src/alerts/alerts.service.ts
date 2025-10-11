import {
  Alert,
  AlertDeliveryMode,
  AlertPayload,
  AlertType,
  RephraseQuestionPayload,
  PromptStudentToLeaveQueuePayload,
  DocumentProcessedPayload,
  AsyncQuestionUpdatePayload,
} from '@koh/common';
import { pick } from 'lodash';
import { Injectable } from '@nestjs/common';
import { QuestionModel } from 'question/question.entity';
import { QueueModel } from '../queue/queue.entity';
import { AlertModel } from './alerts.entity';

@Injectable()
export class AlertsService {
  async removeStaleAlerts(alerts: AlertModel[]): Promise<Alert[]> {
    const nonStaleAlerts = [];

    for (const alert of alerts) {
      switch (alert.alertType) {
        case AlertType.REPHRASE_QUESTION: {
          const payload = alert.payload as RephraseQuestionPayload;
          const question = await QuestionModel.findOne({
            where: { id: payload.questionId },
          });

          const queue = await QueueModel.findOne({
            where: { id: payload.queueId },
            relations: {
              staffList: true,
            },
          });

          const isQueueOpen = queue?.staffList.length > 0 && !queue?.isDisabled;
          if (question?.closedAt || !queue || !isQueueOpen) {
            alert.resolved = new Date();
            await alert.save();
          } else {
            nonStaleAlerts.push(
              pick(alert, [
                'sent',
                'alertType',
                'payload',
                'id',
                'deliveryMode',
                'readAt',
              ]),
            );
          }
          break;
        }
        case AlertType.EVENT_ENDED_CHECKOUT_STAFF:
        case AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE:
        case AlertType.DOCUMENT_PROCESSED:
        case AlertType.ASYNC_QUESTION_UPDATE:
          nonStaleAlerts.push(
            pick(alert, [
              'sent',
              'alertType',
              'payload',
              'id',
              'deliveryMode',
              'readAt',
            ]),
          );
          break;
      }
    }

    return nonStaleAlerts;
  }
  assertPayloadType(alertType: AlertType, payload: AlertPayload): boolean {
    switch (alertType) {
      case AlertType.REPHRASE_QUESTION:
        const castPayload = payload as RephraseQuestionPayload;

        return (
          !!castPayload.courseId &&
          !!castPayload.questionId &&
          !!castPayload.queueId &&
          typeof castPayload.courseId === 'number' &&
          typeof castPayload.questionId === 'number' &&
          typeof castPayload.queueId === 'number'
        );

      case AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE:
        const promptPayload = payload as PromptStudentToLeaveQueuePayload;
        return (
          !!promptPayload.queueId &&
          typeof promptPayload.queueId === 'number' &&
          (promptPayload.queueQuestionId === undefined ||
            typeof promptPayload.queueQuestionId === 'number')
        );

      case AlertType.DOCUMENT_PROCESSED:
      case AlertType.ASYNC_QUESTION_UPDATE:
        const docPayload = payload as DocumentProcessedPayload;
        // For async question update, ensure course/question IDs exist; for document processed, ensure doc info exists
        if ((alertType as AlertType) === AlertType.DOCUMENT_PROCESSED) {
          return (
            typeof docPayload.documentId === 'number' &&
            typeof docPayload.documentName === 'string' &&
            docPayload.documentName.trim().length > 0
          );
        } else {
          const asyncPayload = payload as AsyncQuestionUpdatePayload;
          return (
            typeof (asyncPayload as any).courseId === 'number' &&
            typeof (asyncPayload as any).questionId === 'number'
          );
        }

      default:
        return true;
    }
  }

  async getUnresolvedRephraseQuestionAlert(
    queueId: number,
  ): Promise<AlertModel[]> {
    const alertType = AlertType.REPHRASE_QUESTION;
    return await AlertModel.createQueryBuilder('alert')
      .where('alert.resolved IS NULL')
      .andWhere('alert.alertType = :alertType', { alertType })
      .andWhere("(alert.payload ->> 'queueId')::INTEGER = :queueId ", {
        queueId,
      })
      .getMany();
  }
}
