import { QuestionTypeParams } from '@koh/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, getManager, IsNull } from 'typeorm';
import { QuestionTypeModel } from './question-type.entity';
import { QueueModel } from '../queue/queue.entity';

/**
 * Get data in service of the queue controller and SSE
 * WHY? To ensure data returned by endpoints is *exactly* equal to data sent by SSE
 */
@Injectable()
export class QuestionTypeService {
  async addQuestionType(
    courseId: number,
    queueId: number,
    newQuestionType: QuestionTypeParams,
  ): Promise<string> {
    const existingQuestionType = await QuestionTypeModel.findOne({
      where: {
        cid: courseId,
        queueId: queueId !== null ? queueId : IsNull(),
        name: newQuestionType.name,
      },
    });
    if (existingQuestionType) {
      throw new ConflictException(`${newQuestionType.name} already exists`);
    }

    await getManager().transaction(async (transactionalEntityManager) => {
      if (queueId) {
        await this.addQuestionTypeToQueueConfig(
          queueId,
          newQuestionType,
          transactionalEntityManager,
        );
      }

      await transactionalEntityManager
        .create(QuestionTypeModel, {
          cid: courseId,
          name: newQuestionType.name,
          color: newQuestionType.color,
          queueId: queueId,
        })
        .save();
    });

    return `Successfully created ${newQuestionType.name}`;
  }

  async addQuestionTypeToQueueConfig(
    queueId: number,
    newQuestionType: QuestionTypeParams,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    // update the queue's config to include the new question type
    const queue: QueueModel = await transactionalEntityManager.findOne(
      QueueModel,
      queueId,
    );
    if (!queue) {
      throw new NotFoundException(`Queue ${queueId} not found`);
    }
    queue.config = queue.config || {}; // just in case it's null
    queue.config.tags = queue.config.tags || {}; // just in case it's undefined

    // generate a new tag id based on the question type name
    const newTagId = newQuestionType.name.replace(/[\{\}"\:\,]/g, '');
    if (newTagId.length === 0) {
      throw new BadRequestException(
        'Name cannot only be made of illegal characters',
      );
    }
    // make sure there's no duplicate tag id
    if (queue.config.tags[newTagId]) {
      throw new BadRequestException(`tagId ${newTagId} already exists`);
    }
    queue.config.tags[newTagId] = {
      display_name: newQuestionType.name,
      color_hex: newQuestionType.color,
    };
    await transactionalEntityManager.save(queue);
  }
}
