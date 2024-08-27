import {
  ListQuestionsResponse,
  OpenQuestionStatus,
  Question,
  QueueConfig,
  Role,
  StatusInPriorityQueue,
  StatusInQueue,
  StatusSentToCreator,
} from '@koh/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { classToClass } from 'class-transformer';
import { pick } from 'lodash';
import { QuestionModel } from 'question/question.entity';
import { getManager, In } from 'typeorm';
import { QueueModel } from './queue.entity';
import { AlertsService } from '../alerts/alerts.service';
import { ApplicationConfigService } from 'config/application_config.service';
import { QuestionTypeModel } from 'questionType/question-type.entity';

/**
 * Get data in service of the queue controller and SSE
 * WHY? To ensure data returned by endpoints is *exactly* equal to data sent by SSE
 */
@Injectable()
export class QueueService {
  constructor(
    private alertsService: AlertsService,
    private readonly appConfig: ApplicationConfigService,
  ) {}

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

    const questionsFromDb = await QuestionModel.inQueueWithStatus(
      queueId,
      [...StatusInPriorityQueue, ...StatusInQueue, OpenQuestionStatus.Helping],
      this.appConfig.get('max_questions_per_queue'),
    )
      .leftJoinAndSelect('question.questionTypes', 'questionTypes')
      .leftJoinAndSelect('question.creator', 'creator')
      .leftJoinAndSelect('question.taHelped', 'taHelped')
      .getMany();

    const unresolvedRephraseQuestionAlerts =
      await this.alertsService.getUnresolvedRephraseQuestionAlert(queueId);

    const queueQuestions = new ListQuestionsResponse();

    queueQuestions.questions = questionsFromDb.filter((question) =>
      StatusInQueue.includes(question.status as OpenQuestionStatus),
    );

    queueQuestions.questionsGettingHelp = questionsFromDb.filter(
      (question) =>
        question.status === OpenQuestionStatus.Helping && !question.groupId,
    );

    queueQuestions.priorityQueue = questionsFromDb.filter((question) =>
      StatusInPriorityQueue.includes(question.status as OpenQuestionStatus),
    );

    queueQuestions.groups = [];

    queueQuestions.unresolvedAlerts = unresolvedRephraseQuestionAlerts.map(
      (alert) => alert.payload,
    );

    queueQuestions.questions = queueQuestions.questions.map((question) => {
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
    return queueQuestions;
  }

  /** Hide sensitive data to other students */
  // TODO: remove this function since it gives no new information for the client (like the client already has their own name and pfp and their own questions, so why are we attaching those things together here on the server?)
  async personalizeQuestions(
    queueId: number,
    queueQuestions: ListQuestionsResponse,
    userId: number,
    role: Role,
  ): Promise<ListQuestionsResponse> {
    if (role === Role.STUDENT) {
      const newLQR = new ListQuestionsResponse();
      Object.assign(newLQR, queueQuestions);

      if (queueQuestions.questions) {
        newLQR.questions = queueQuestions.questions.map((question) => {
          const creator =
            question.creator.id === userId
              ? question.creator
              : pick(question.creator, ['id']);
          // classToClass transformer will apply the @Excludes
          return classToClass<Question>(
            QuestionModel.create({ ...question, creator }),
          );
        });
      }

      if (queueQuestions.questionsGettingHelp) {
        newLQR.questionsGettingHelp = queueQuestions.questionsGettingHelp.map(
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
      }

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
    return queueQuestions;
  }

  async updateQueueConfigAndTags(
    queueId: number,
    newConfig: QueueConfig,
  ): Promise<string[]> {
    const questionTypeMessages: string[] = []; // this will contain messages about what question types were created, updated, or deleted
    const queue = await this.getQueue(queueId);

    const oldConfig: QueueConfig = queue.config ?? { tags: {} };

    await getManager().transaction(async (transactionalEntityManager) => {
      // update the question types
      // to do so, compare the tag ids of the old config vs the new config:
      // - if there's a new tag id, make a new question type
      // - if there's a missing tag id, delete the question type
      // - if there's a tag id that's in both, update the question type

      // tags to delete
      const oldTagKeys =
        oldConfig && oldConfig.tags ? Object.keys(oldConfig.tags) : [];
      const newTagKeys = newConfig.tags ? Object.keys(newConfig.tags) : [];
      const tagsToDelete = oldTagKeys.filter(
        (tag) => !newTagKeys.includes(tag),
      );
      for (const tagId of tagsToDelete) {
        const deleted = await transactionalEntityManager.delete(
          QuestionTypeModel,
          { queueId, name: oldConfig.tags[tagId].display_name },
        );
        if (deleted.affected > 0) {
          questionTypeMessages.push(
            `Deleted tag: ${oldConfig.tags[tagId].display_name}`,
          );
        }
      }

      // tags to update or create
      if (newConfig.tags) {
        for (const [newTagId, newTag] of Object.entries(newConfig.tags)) {
          if (oldConfig && oldConfig.tags && oldConfig.tags[newTagId]) {
            // update the question type if the color_hex or display_name has changed
            const oldTag = oldConfig.tags[newTagId];
            if (
              oldTag.color_hex !== newTag.color_hex ||
              oldTag.display_name !== newTag.display_name
            ) {
              const updated = await transactionalEntityManager.update(
                QuestionTypeModel,
                { queueId, name: oldTag.display_name },
                { color: newTag.color_hex, name: newTag.display_name },
              );
              if (updated.affected > 0) {
                questionTypeMessages.push(
                  `Updated tag: ${newTag.display_name}`,
                );
              }
            }
          } else {
            // create a new question type
            await transactionalEntityManager.insert(QuestionTypeModel, {
              queueId,
              cid: queue.courseId,
              color: newTag.color_hex,
              name: newTag.display_name,
            });
            questionTypeMessages.push(`Created tag: ${newTag.display_name}`);
          }
        }
      }

      // set config for a queue
      queue.config = newConfig;
      await transactionalEntityManager.save(queue);
    });

    return questionTypeMessages;
  }
}
