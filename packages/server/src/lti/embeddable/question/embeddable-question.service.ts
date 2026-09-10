import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  EmbeddableQuestionFeedback,
  EmbeddableQuestionFeedbackParams,
  ERROR_MESSAGES,
  GradingEvaluation,
  QuizContext,
  StudentEmbeddableQuestion,
  UpsertEmbeddableQuestionParams,
} from '@koh/common';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { EmbeddableQuestionFeedbackModel } from './embeddable-question-feedback.entity';
import { EmbeddableQuizModel } from '../quiz/embeddable-quiz.entity';
import { QuestionGradingService } from './question-grading.service';

@Injectable()
export class EmbeddableQuestionService {
  constructor(
    private readonly questionGradingService: QuestionGradingService,
  ) {}

  async getFeedback({
    submission,
    questionId,
    courseId,
    userId,
  }: {
    submission: EmbeddableQuestionFeedbackParams['responseText'];
    questionId: number;
    courseId: number;
    userId: number;
  }): Promise<EmbeddableQuestionFeedback> {
    const question = await this.findOne(courseId, questionId);
    const quizContext = await this.getQuizContext(question);

    let evaluation: GradingEvaluation;
    try {
      evaluation = await this.questionGradingService.evaluate({
        courseId,
        questionText: question.questionText,
        gradingSettings: question.gradingSettings,
        quizContext,
        submission,
        mode: 'feedback',
      });
    } catch {
      throw new InternalServerErrorException(
        'Failed to generate feedback for this answer.',
      );
    }

    const saved = await EmbeddableQuestionFeedbackModel.create({
      courseId,
      questionId,
      userId,
      submission,
      aiFeedback: evaluation.comment,
      aiGrade: evaluation.score,
      appliedRequirements: evaluation.appliedRequirements,
      aiModel: evaluation.model,
      maxScore: evaluation.maxScore,
      gradingSnapshot: evaluation.gradingSnapshot,
    }).save();

    return {
      score: saved.aiGrade,
      comment: saved.aiFeedback,
      appliedRequirements: saved.appliedRequirements,
      maxScore: saved.maxScore ?? evaluation.maxScore,
    };
  }

  async findAllForCourse(courseId: number): Promise<EmbeddableQuestionModel[]> {
    return EmbeddableQuestionModel.find({
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
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.notFound);
    }
    return question;
  }

  async upsert(
    courseId: number,
    params: UpsertEmbeddableQuestionParams,
    questionId?: number,
  ): Promise<EmbeddableQuestionModel> {
    const quiz =
      params.quizId === null
        ? null
        : await this.findQuiz(courseId, params.quizId);
    const question =
      questionId === undefined
        ? EmbeddableQuestionModel.create({ courseId })
        : await this.findOne(courseId, questionId);

    EmbeddableQuestionModel.merge(question, {
      title: params.title,
      questionText: params.questionText,
      quizId: params.quizId,
      quiz,
      gradingSettings: structuredClone(params.gradingSettings),
    });
    return question.save();
  }

  async delete(courseId: number, questionId: number): Promise<void> {
    await this.findOne(courseId, questionId);
    const feedbackCount = await EmbeddableQuestionFeedbackModel.count({
      where: { courseId, questionId },
    });
    if (feedbackCount > 0) {
      throw new ConflictException(
        'Cannot delete a question that has feedback history.',
      );
    }
    await EmbeddableQuestionModel.delete({ id: questionId, courseId });
  }

  async getStudentQuestion(
    courseId: number,
    questionId: number,
  ): Promise<StudentEmbeddableQuestion> {
    const question = await this.findOne(courseId, questionId);
    return {
      id: question.id,
      courseId: question.courseId,
      questionText: question.questionText,
    };
  }

  private async findQuiz(
    courseId: number,
    quizId: number,
  ): Promise<EmbeddableQuizModel> {
    const quiz = await EmbeddableQuizModel.findOne({
      where: { id: quizId, courseId },
    });
    if (!quiz) {
      throw new BadRequestException(
        'The selected quiz does not belong to this course.',
      );
    }
    return quiz;
  }

  private async getQuizContext(
    question: EmbeddableQuestionModel,
  ): Promise<QuizContext | null> {
    if (question.quizId === null) return null;
    const quiz = await this.findQuiz(question.courseId, question.quizId);
    return {
      id: quiz.id,
      title: quiz.title,
      objective: quiz.objective,
      background: quiz.background,
    };
  }
}
