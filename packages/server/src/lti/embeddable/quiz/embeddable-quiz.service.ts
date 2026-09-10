import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ERROR_MESSAGES, UpsertEmbeddableQuizParams } from '@koh/common';
import { EmbeddableQuestionModel } from '../question/embeddable-question.entity';
import { EmbeddableQuizModel } from './embeddable-quiz.entity';

@Injectable()
export class EmbeddableQuizService {
  async findAllForCourse(courseId: number): Promise<EmbeddableQuizModel[]> {
    return EmbeddableQuizModel.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(
    courseId: number,
    quizId: number,
  ): Promise<EmbeddableQuizModel> {
    const quiz = await EmbeddableQuizModel.findOne({
      where: { id: quizId, courseId },
    });
    if (!quiz) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.notFound);
    }
    return quiz;
  }

  async upsert(
    courseId: number,
    params: UpsertEmbeddableQuizParams,
    quizId?: number,
  ): Promise<EmbeddableQuizModel> {
    const quiz =
      quizId === undefined
        ? EmbeddableQuizModel.create({ courseId })
        : await this.findOne(courseId, quizId);

    EmbeddableQuizModel.merge(quiz, {
      title: params.title,
      objective: params.objective,
      background: params.background,
    });
    return quiz.save();
  }

  async delete(courseId: number, quizId: number): Promise<void> {
    await this.findOne(courseId, quizId);
    const questionCount = await EmbeddableQuestionModel.count({
      where: { courseId, quizId },
    });
    if (questionCount > 0) {
      throw new BadRequestException(
        'Cannot delete a quiz while it still contains questions.',
      );
    }
    await EmbeddableQuizModel.delete({ id: quizId, courseId });
  }
}
