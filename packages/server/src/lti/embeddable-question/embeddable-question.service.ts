import { Injectable, NotFoundException } from '@nestjs/common';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { CreateEmbeddableQuestionParams, UpdateEmbeddableQuestionParams } from '@koh/common'
import { DeepPartial } from 'typeorm'

@Injectable()
export class EmbeddableQuestionService {
  async findAllForCourse(courseId: number): Promise<EmbeddableQuestionModel[]> {
    return await EmbeddableQuestionModel.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(
    courseId: number,
    questionId: number,
  ): Promise<EmbeddableQuestionModel> {
    const question = await EmbeddableQuestionModel.findOne({
      where: { id: questionId, courseId },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

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

  async delete(questionId: number): Promise<void> {
    await EmbeddableQuestionModel.delete({
      id: questionId
    });
  }
}
