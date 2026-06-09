import { Injectable, NotFoundException } from '@nestjs/common'
import { EmbeddableQuestionModel } from './embeddable-question.entity'
import { ERROR_MESSAGES, UpdateEmbeddableFeedbackParams, UpsertEmbeddableQuestionParams } from '@koh/common'
import { DeepPartial, FindOptionsRelations, In } from 'typeorm'
import { EmbeddableQuestionFeedbackModel } from './embeddable-question-feedback.entity'
import * as ExcelJS from 'exceljs'
import { EmbeddableModuleService } from '../embeddable-module.service'

@Injectable()
export class EmbeddableQuestionService {
  constructor(
    private embeddableModuleService: EmbeddableModuleService
  ) {}

  /**
   * Obtains feedback & a preliminary grade for a response to an embeddable question
   *
   * @param submission The submission to obtain feedback for
   * @param questionId The question the submission is for
   * @param courseId The course in which the question resides
   * @param userId The user ID of the invoking user
   */
  async getFeedback(
    submission: string,
    questionId: number,
    courseId: number,
    userId: number,
  ): Promise<EmbeddableQuestionFeedbackModel> {
    return await this.embeddableModuleService.getFeedback(
      EmbeddableQuestionModel.getRepository(),
      {
        id: questionId,
      },
      EmbeddableQuestionFeedbackModel.getRepository(),
      courseId,
      submission,
      (item) => item,
      {
        questionId,
        userId,
      },
    );
  }

  /**
   * Finds all embeddable question instances for a given course
   * @param courseId
   * @param relations (Optional) Relations to include with the questions
   */
  async findAllForCourse(courseId: number, relations?: FindOptionsRelations<EmbeddableQuestionModel>): Promise<EmbeddableQuestionModel[]> {
    return await EmbeddableQuestionModel.find({
      where: { courseId, isWeak: false },
      order: { createdAt: 'ASC' },
      relations,
    });
  }

  /**
   * Finds one embeddable question instance based on its ID
   * @param questionId
   * @param relations (Optional) Relations to include with the question
   */
  async findOne(
    questionId: number,
    relations?: FindOptionsRelations<EmbeddableQuestionModel>,
  ): Promise<EmbeddableQuestionModel> {
    const question = await EmbeddableQuestionModel.findOne({
      where: { id: questionId, isWeak: false },
      relations,
    });
    if (!question) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.notFound);
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
    params: UpsertEmbeddableQuestionParams,
    questionId?: number,
  ): Promise<EmbeddableQuestionModel> {
    const count = await EmbeddableQuestionModel.count({
      where: {
        courseId
      }
    })
    const question = EmbeddableQuestionModel.create({
      courseId,
      id: questionId,
      ...params,
      name: params.name || `Question ${count+1}`,
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
  async getAnswers(questionId: number, users?: number[]): Promise<EmbeddableQuestionFeedbackModel[]> {
    return await this.embeddableModuleService.getAnswers(
      EmbeddableQuestionFeedbackModel.getRepository(),
      {
        questionId,
      },
      {
        user: true,
        embeddableQuestion: true,
      },
      users,
    );
  }

  /**
   * Updates feedback with the given answerId with the provided parameters
   * @param answerId
   * @param params
   */
  async updateAnswer(answerId: number, params: UpdateEmbeddableFeedbackParams): Promise<EmbeddableQuestionFeedbackModel> {
    return await this.embeddableModuleService.updateAnswer(EmbeddableQuestionFeedbackModel.getRepository(), answerId, params);
  }

  /**
   * Deletes feedback with the given answerId
   * @param answerId
   */
  async deleteAnswer(answerId: number) {
    await this.embeddableModuleService.deleteAnswer(EmbeddableQuestionFeedbackModel.getRepository(), answerId);
  }

  /**
   * Exports embeddable question results from the provided course constrained to the given parameters
   *
   * @param courseId The course to export question data from
   * @param questionIds The questions to export data from
   * @param includeAiFeedback Whether to include AI assessment feedback
   * @param includeNonSubmitters Whether to include ALL students in the course, or just those who submitted, for each question
   *
   * @returns Promise<Blob> A promise which evaluates to a Blob with buffer data that can be used to reconstruct an Excel sheet
   */
  async exportFeedback(
    courseId: number,
    questionIds: number[],
    includeAiFeedback: boolean,
    includeNonSubmitters: boolean,
  ): Promise<ExcelJS.Buffer> {
    const questions = await EmbeddableQuestionModel.find({
      where: {
        courseId,
        id: In(questionIds),
      },
      order: {
        createdAt: 'ASC'
      },
      relations: {
        submissions: {
          user: true,
        }
      }
    });

    return await this.embeddableModuleService.buildExcel(
      courseId,
      questions,
      includeNonSubmitters,
      includeAiFeedback
    )
  }
}
