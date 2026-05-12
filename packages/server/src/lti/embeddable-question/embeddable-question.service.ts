import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import {
  CreateEmbeddableQuestionParams,
  ERROR_MESSAGES,
  UpdateEmbeddableFeedbackParams,
  UpdateEmbeddableQuestionParams,
} from '@koh/common'
import { DeepPartial, FindOptionsWhere, In } from 'typeorm'
import { EmbeddableFeedbackModel } from './embeddable-feedback.entity'
import { ChatbotApiService } from '../../chatbot/chatbot-api.service'
import * as Sentry from '@sentry/nestjs'

@Injectable()
export class EmbeddableQuestionService {
  constructor(
    private chatbotApiService: ChatbotApiService,
  ) {}

  /**
   * Obtains feedback & a preliminary grade for a response to an embeddable question
   */
  async getFeedback(
    responseText: string,
    questionId: number,
    courseId: number,
    userId: number,
  ): Promise<EmbeddableFeedbackModel> {
    const question = await this.findOne(
      questionId,
    );

    if (question.availableFrom && question.availableFrom.getTime() > Date.now()) {
      throw new UnauthorizedException(ERROR_MESSAGES.embeddableQuestionController.notAvailableYet);
    } else if (question.availableUntil && question.availableUntil.getTime() < Date.now()) {
      throw new UnauthorizedException(ERROR_MESSAGES.embeddableQuestionController.noLongerAvailable);
    }

    const feedback = await this.chatbotApiService.queryChatbot(
      responseText,
      '',
      'feedback',
      {
        question: question.questionText,
        criteria: question.criteriaText,
        instructions: question.instructions,
      },
      courseId
    );

    // Grade shouldn't be necessary, so wrap in try-catch
    let grade: number | undefined;
    try {
      const gradeResponse = await this.chatbotApiService.queryChatbot(
        responseText,
        '',
        'grade',
        {
          question: question.questionText,
          criteria: question.criteriaText,
          feedback,
        },
        courseId
      );

      console.log(gradeResponse)

      grade = Number(parseFloat(gradeResponse.match(/[+-]?\d+(\.\d+)?/g)[0]))
      if (isNaN(grade)) {
        grade = undefined;
        throw new Error('Grade response did not contain a valid numeric grade');
      }
    } catch (err) {
      console.error(`Failed to generate grade: ${err}`)
      Sentry.captureEvent(err);
    }

    return await EmbeddableFeedbackModel.create({
      questionId,
      userId,
      submission: responseText,
      aiFeedback: feedback,
      aiGrade: grade,
    }).save();
  }

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

  /**
   * Retrieves feedback for the given question and users, if provided
   * @param questionId
   * @param users (Optional) IDs for users to pull data for
   */
  async getAnswers(questionId: number, users?: number[]): Promise<EmbeddableFeedbackModel[]> {
    let where: FindOptionsWhere<EmbeddableFeedbackModel> = {
      questionId,
    }
    if (users && users.length > 0) {
      where = {
        ...where,
        userId: In(users)
      }
    }

    return await EmbeddableFeedbackModel.find({
      where,
      relations: {
        user: true,
        embeddableQuestion: true,
      }
    });
  }

  /**
   * Updates feedback with the given answerId with the provided parameters
   * @param answerId
   * @param params
   */
  async updateAnswer(answerId: number, params: UpdateEmbeddableFeedbackParams): Promise<EmbeddableFeedbackModel> {
    const feedback = await EmbeddableFeedbackModel.findOne({
      where: {
        id: answerId,
      }
    });
    if (!feedback) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableQuestionController.feedbackNotFound);
    }
    Object.assign(feedback,params);
    return await feedback.save();
  }

  /**
   * Deletes feedback with the given answerId
   * @param answerId
   */
  async deleteAnswer(answerId: number) {
    return await EmbeddableFeedbackModel.delete({
      id: answerId,
    });
  }
}
