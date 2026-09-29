import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  EmbeddableQuestionFeedback,
  EmbeddableQuestionFeedbackParams,
  ERROR_MESSAGES,
  GradingEvaluation,
  questionGradingSettingsSchema,
  StudentEmbeddableQuestion,
  UpsertEmbeddableQuestionParams,
} from '@koh/common';
import { EmbeddableQuestionModel } from './embeddable-question.entity';
import { EmbeddableQuestionFeedbackModel } from './embeddable-question-feedback.entity';
import { QuestionGradingService } from './question-grading.service';

@Injectable()
export class EmbeddableQuestionService {
  private readonly logger = new Logger(EmbeddableQuestionService.name);
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

    let evaluation: GradingEvaluation;
    try {
      evaluation = await this.questionGradingService.evaluate({
        courseId,
        questionText: question.questionText,
        gradingSettings: question.gradingSettings,
        submission,
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Grading failed for question ${questionId}: ${error instanceof HttpException ? error.getStatus() : 'invalid evaluation'}`,
      );
      if (error instanceof HttpException) {
        const status = error.getStatus();
        if (
          status === HttpStatus.PAYLOAD_TOO_LARGE ||
          (status === HttpStatus.BAD_REQUEST &&
            /context.{0,40}(size|length|window)|too many tokens/i.test(detail))
        ) {
          throw new BadRequestException(
            'The question and your answer are too long for the feedback model. Shorten your answer or ask your instructor to shorten the question or rubric. Your answer was not saved.',
          );
        }
        if (
          status === HttpStatus.BAD_REQUEST ||
          status === HttpStatus.UNAUTHORIZED ||
          status === HttpStatus.FORBIDDEN
        ) {
          throw new HttpException(
            'Feedback is unavailable for this question. Please contact your instructor. Your answer was not saved.',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (status === HttpStatus.GATEWAY_TIMEOUT) {
          throw new HttpException(
            'Feedback took too long to generate. Your answer was not saved. Please try again.',
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }
      }
      throw new InternalServerErrorException(
        'We could not generate valid feedback. Your answer was not saved. Please try again.',
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
      reasons: evaluation.reasons,
      humanReviewReason: evaluation.humanReviewReason,
    }).save();

    return {
      score: saved.aiGrade,
      comment: saved.aiFeedback,
      appliedRequirements: saved.appliedRequirements,
      maxScore: saved.maxScore,
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
    // The shared Zod schema is the one authoritative grading-settings
    // validator: the DTO constraint only returns a boolean, so normalization
    // (trimmed strings, unknown-key stripping) happens exactly once here.
    const parsed = questionGradingSettingsSchema.safeParse(
      params.gradingSettings,
    );
    if (!parsed.success) {
      throw new BadRequestException('gradingSettings is invalid.');
    }
    const question =
      questionId === undefined
        ? EmbeddableQuestionModel.create({ courseId })
        : await this.findOne(courseId, questionId);

    EmbeddableQuestionModel.merge(question, {
      title: params.title,
      questionText: params.questionText,
      gradingSettings: parsed.data,
    });
    return question.save();
  }

  async delete(courseId: number, questionId: number): Promise<void> {
    await this.findOne(courseId, questionId);
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
}
