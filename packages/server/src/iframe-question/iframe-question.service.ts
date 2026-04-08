import { Injectable, NotFoundException } from '@nestjs/common';
import { IframeQuestionModel } from './iframe-question.entity';

@Injectable()
export class IframeQuestionService {
  async create(
    courseId: number,
    questionText: string,
    criteriaText?: string,
  ): Promise<IframeQuestionModel> {
    const question = IframeQuestionModel.create({
      courseId,
      questionText,
      criteriaText: criteriaText || null,
    });
    return await question.save();
  }

  async findAllForCourse(courseId: number): Promise<IframeQuestionModel[]> {
    return await IframeQuestionModel.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(
    courseId: number,
    questionId: number,
  ): Promise<IframeQuestionModel> {
    const question = await IframeQuestionModel.findOne({
      where: { id: questionId, courseId },
    });
    if (!question) {
      throw new NotFoundException('Question not found');
    }
    return question;
  }

  async update(
    courseId: number,
    questionId: number,
    questionText?: string,
    criteriaText?: string,
  ): Promise<IframeQuestionModel> {
    const question = await this.findOne(courseId, questionId);
    if (questionText !== undefined) {
      question.questionText = questionText;
    }
    if (criteriaText !== undefined) {
      question.criteriaText = criteriaText;
    }
    return await question.save();
  }

  async delete(courseId: number, questionId: number): Promise<void> {
    const question = await this.findOne(courseId, questionId);
    await question.remove();
  }
}
