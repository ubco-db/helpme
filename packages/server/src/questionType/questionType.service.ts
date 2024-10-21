import { generateTagIdFromName, QuestionTypeParams } from '@koh/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, getManager, IsNull } from 'typeorm';
import { QuestionTypeModel } from './question-type.entity';
import { QueueModel } from '../queue/queue.entity';

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

      await transactionalEntityManager.save(QuestionTypeModel, {
        cid: courseId,
        name: newQuestionType.name,
        color: newQuestionType.color,
        queueId: queueId,
      });
    });

    return `Successfully created ${newQuestionType.name}`;
  }

  async addQuestionTypeToQueueConfig(
    queueId: number,
    newQuestionType: QuestionTypeParams,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    // update the queue's config to include the new question type
    const queue = await transactionalEntityManager.findOne(
      QueueModel,
      queueId,
      {
        lock: { mode: 'pessimistic_write' },
      },
    );
    if (!queue) {
      throw new NotFoundException(`Queue ${queueId} not found`);
    }
    queue.config = queue.config || {}; // just in case it's null
    queue.config.tags = queue.config.tags || {}; // just in case it's undefined

    // generate a new tag id based on the question type name
    const newTagId = generateTagIdFromName(newQuestionType.name);
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

  /**
   * Edits a question type.
   * Note that this does not update the queue config.
   * Returns the new name of the question type (if it has changed).
   */
  async editQuestionType(
    oldQuestionType: QuestionTypeModel,
    newQuestionType: QuestionTypeParams,
  ): Promise<string> {
    const oldName = oldQuestionType.name;
    if (newQuestionType.name) {
      oldQuestionType.name = newQuestionType.name;
    }
    if (newQuestionType.color) {
      oldQuestionType.color = newQuestionType.color;
    }
    await oldQuestionType.save();

    if (newQuestionType.name !== oldName) {
      return `${newQuestionType.name}`;
    } else {
      return '';
    }
  }
}
