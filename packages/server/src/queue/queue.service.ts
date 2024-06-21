import {
  ListQuestionsResponse,
  OpenQuestionStatus,
  Question,
  QuestionGroup,
  Role,
  StatusInPriorityQueue,
  StatusInQueue,
  StatusSentToCreator,
} from '@koh/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { classToClass } from 'class-transformer';
import { pick } from 'lodash';
import { QuestionModel } from 'question/question.entity';
import { In } from 'typeorm';
import { QueueModel } from './queue.entity';
import { AlertsService } from '../alerts/alerts.service';

/**
 * Get data in service of the queue controller and SSE
 * WHY? To ensure data returned by endpoints is *exactly* equal to data sent by SSE
 */
@Injectable()
export class QueueService {
  constructor(private alertsService: AlertsService) {}

  async getQueue(queueId: number): Promise<QueueModel> {
    const queue = await QueueModel.findOne(queueId, {
      relations: ['staffList'],
    });
    await queue.checkIsOpen();
    await queue.addQueueSize();

    return queue;
  }

  async getQuestions(queueId: number): Promise<ListQuestionsResponse> {
    // todo: Make a student and a TA version of this function, and switch which one to use in the controller
    // for now, just return the student response
    const queueSize = await QueueModel.count({
      where: { id: queueId },
    });
    // Check that the queue exists
    if (queueSize === 0) {
      throw new NotFoundException();
    }

    const questionsFromDb = await QuestionModel.inQueueWithStatus(queueId, [
      ...StatusInPriorityQueue,
      ...StatusInQueue,
      OpenQuestionStatus.Helping,
    ])
      .leftJoinAndSelect('question.questionTypes', 'questionTypes')
      .leftJoinAndSelect('question.creator', 'creator')
      .leftJoinAndSelect('question.taHelped', 'taHelped')
      .getMany();

    const unresolvedRephraseQuestionAlerts =
      await this.alertsService.getUnresolvedRephraseQuestionAlert(queueId);

    const questions = new ListQuestionsResponse();

    questions.queue = questionsFromDb.filter((question) =>
      StatusInQueue.includes(question.status as OpenQuestionStatus),
    );

    questions.questionsGettingHelp = questionsFromDb.filter(
      (question) =>
        question.status === OpenQuestionStatus.Helping && !question.groupId,
    );

    questions.priorityQueue = questionsFromDb.filter((question) =>
      StatusInPriorityQueue.includes(question.status as OpenQuestionStatus),
    );

    questions.groups = [];

    questions.unresolvedAlerts = unresolvedRephraseQuestionAlerts.map(
      (alert) => alert.payload,
    );

    questions.queue = questions.queue.map((question) => {
      const temp = pick(question, [
        'id',
        'queueId',
        'text',
        'creatorId',
        'taHelpedId',
        'createdAt',
        'firstHelpedAt',
        'helpedAt',
        'closedAt',
        'status',
        'location',
        'groupable',
        'groupId',
        'questionTypes',
        'taHelped',
        'isTaskQuestion',
      ]);

      Object.assign(temp, {
        creator: {
          name: question.creator.name,
          photoURL: question.creator.photoURL,
        },
      });

      return temp as Question;
    });
    return questions;
  }

  /** Hide sensitive data to other students */
  async personalizeQuestions(
    queueId: number,
    questions: ListQuestionsResponse,
    userId: number,
    role: Role,
  ): Promise<ListQuestionsResponse> {
    if (role === Role.STUDENT) {
      const newLQR = new ListQuestionsResponse();
      Object.assign(newLQR, questions);

      newLQR.queue = questions.queue.map((question) => {
        const creator =
          question.creator.id === userId
            ? question.creator
            : pick(question.creator, ['id']);
        // classToClass transformer will apply the @Excludes
        return classToClass<Question>(
          QuestionModel.create({ ...question, creator }),
        );
      });

      newLQR.questionsGettingHelp = questions.questionsGettingHelp.map(
        (question) => {
          const creator =
            question.creator.id === userId
              ? question.creator
              : pick(question.creator, ['id']);
          // classToClass transformer will apply the @Excludes
          return classToClass<Question>(
            QuestionModel.create({ ...question, creator }),
          );
        },
      );

      newLQR.yourQuestions = await QuestionModel.find({
        relations: ['creator', 'taHelped'],
        where: {
          creatorId: userId,
          queueId: queueId,
          status: In(StatusSentToCreator),
        },
      });
      newLQR.priorityQueue = [];

      if (newLQR.yourQuestions) {
        newLQR.yourQuestions = newLQR.yourQuestions.map((question) => {
          const temp = pick(question, [
            'closedAt',
            'queueId',
            'createdAt',
            'creatorId',
            'firstHelpedAt',
            'groupId',
            'groupable',
            'helpedAt',
            'id',
            'location',
            'questionTypes',
            'queueId',
            'status',
            'taHelpedId',
            'taHelped',
            'text',
            'isTaskQuestion',
          ]);

          return Object.assign(temp, {
            creator: {
              name: question.creator.name,
              photoURL: question.creator.photoURL,
            },
          }) as Question;
        });
      }
      return newLQR;
    }
    return questions;
  }
}
