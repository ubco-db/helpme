import { Injectable, NotFoundException } from '@nestjs/common';
import { IFrameQuestionModel } from './iframe-question.entity';
import { CreateIFrameQuestionParams, UpdateIFrameQuestionParams } from '@koh/common'
import { DeepPartial } from 'typeorm'

@Injectable()
export class IFrameQuestionService {
  async findAllForCourse(courseId: number): Promise<IFrameQuestionModel[]> {
    return await IFrameQuestionModel.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(
    courseId: number,
    questionId: number,
  ): Promise<IFrameQuestionModel> {
    const question = await IFrameQuestionModel.findOne({
      where: { id: questionId, courseId },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async upsert(
    courseId: number,
    params: CreateIFrameQuestionParams | UpdateIFrameQuestionParams,
    questionId?: number,
  ): Promise<IFrameQuestionModel> {
    const question = IFrameQuestionModel.create({
      courseId,
      id: questionId,
      ...params,
    } as DeepPartial<IFrameQuestionModel>);
    return await question.save();
  }

  async delete(questionId: number): Promise<void> {
    await IFrameQuestionModel.delete({
      id: questionId
    });
  }
}
