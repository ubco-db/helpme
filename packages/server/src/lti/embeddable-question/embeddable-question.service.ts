import { Injectable, NotFoundException } from '@nestjs/common';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { CreateEmbeddableQuestionParams, ERROR_MESSAGES, UpdateEmbeddableQuestionParams } from '@koh/common'
import { DeepPartial } from 'typeorm'

@Injectable()
export class EmbeddableQuestionService {
  /**
   * Finds all embeddable question instances for a given course
   * @param courseId
   */
  async findAllForCourse(courseId: number): Promise<EmbeddableQuestionModel[]> {
    return await EmbeddableQuestionModel.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Finds one embeddable question instance based on its ID
   * @param questionId
   */
  async findOne(
    questionId: number,
  ): Promise<EmbeddableQuestionModel> {
    const question = await EmbeddableQuestionModel.findOne({
      where: { id: questionId },
    });
    if (!question) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableQuestionController.notFound);
    }
    return question;
  }

  /**
   * Performs an insert/update operation depending on passed parameters for an embeddable question
   * @param courseId
   * @param params Parameters to update/create an embeddable question
   * @param questionId (Optional) Used to determine whether operation is an update/insert (if question ID exists in DB)
   */
  async upsert(
    courseId: number,
    params: CreateEmbeddableQuestionParams | UpdateEmbeddableQuestionParams,
    questionId?: number,
  ): Promise<EmbeddableQuestionModel> {
    const question = EmbeddableQuestionModel.create({
      courseId,
      id: questionId,
      ...params,
    } as DeepPartial<EmbeddableQuestionModel>);
    return await question.save();
  }

  /**
   * Deletes the embeddable question with the given ID, if any
   * @param questionId
   */
  async delete(questionId: number): Promise<void> {
    await EmbeddableQuestionModel.delete({
      id: questionId
    });
  }
}
