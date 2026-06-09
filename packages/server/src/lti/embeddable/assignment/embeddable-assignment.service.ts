import { Injectable, NotFoundException } from '@nestjs/common'
import { EmbeddableModuleService } from '../embeddable-module.service'
import * as ExcelJS from 'exceljs'
import { EmbeddableAssignmentQuestionModel } from './embeddable-assignment-question.entity'
import { EmbeddableAssignmentFeedbackModel } from './embeddable-assignment-feedback.entity'
import {
  ERROR_MESSAGES,
  UpdateEmbeddableFeedbackParams,
  UpsertEmbeddableAssignmentParams,
  UpsertEmbeddableAssignmentQuestionParams,
} from '@koh/common'
import { DataSource, DeepPartial, EntityManager, FindOptionsOrder, FindOptionsRelations, In } from 'typeorm'
import { EmbeddableQuestionModel } from '../question/embeddable-question.entity'
import { EmbeddableAssignmentModel } from './embeddable-assignment.entity'
import { pick } from 'lodash'

@Injectable()
export class EmbeddableAssignmentService {
  constructor(
    private dataSource: DataSource,
    private embeddableModuleService: EmbeddableModuleService
  ) {}

  /**
   * Finds all embeddable assignment instances for a given course
   *
   * @param courseId
   * @param relations (Optional) Relations to include with the questions
   */
  async findAllForCourse(courseId: number, relations?: FindOptionsRelations<EmbeddableAssignmentModel>): Promise<EmbeddableAssignmentModel[]> {
    return await EmbeddableAssignmentModel.find({
      where: { courseId },
      order: {
        createdAt: 'ASC',
        questions: {
          order: 'ASC',
        }
      },
      relations,
    });
  }

  /**
   * Finds one embeddable assignment instance based on its ID
   *
   * @param assignmentId
   * @param relations (Optional) Relations to include with the question
   */
  async findOne(
    assignmentId: number,
    relations?: FindOptionsRelations<EmbeddableAssignmentModel>,
  ): Promise<EmbeddableAssignmentModel> {
    const order: FindOptionsOrder<EmbeddableAssignmentModel> = {}
    if (relations && 'questions' in relations)
      order['questions'] = {
        order: 'ASC',
      }

    const assignment = await EmbeddableAssignmentModel.findOne({
      where: { id: assignmentId },
      relations,
      order,
    });
    if (!assignment) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.assignmentNotFound);
    }
    return assignment;
  }

  /**
   * Upserts an embeddable assignment with the given parameters.
   *
   * @param courseId The course in which the assignment should reside.
   * @param params The parameters used for upsert - this includes the associated questions, name, and dates for open/closure of the assignment.
   * @param assignmentId The assignment ID, in the case of an update operation
   */
  async upsert(
    courseId: number,
    params: UpsertEmbeddableAssignmentParams,
    assignmentId?: number,
  ): Promise<EmbeddableAssignmentModel> {
    let inserted: EmbeddableAssignmentModel;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const em = queryRunner.manager;

      const assignmentRepo = em.getRepository(
        EmbeddableAssignmentModel,
      );

      const assignment = await assignmentRepo.save({
        courseId,
        id: assignmentId,
        ...pick(params, ['availableFrom','availableUntil','name']),
      } as DeepPartial<EmbeddableAssignmentModel>);

      if (!assignmentId)
        assignmentId = assignment.id;

      await this.associateQuestions(
        courseId,
        assignmentId,
        params.questions,
        em,
      )

      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive && !queryRunner.isReleased) {
        await queryRunner.rollbackTransaction();
      }
      if (inserted) {
        // Just in case the transaction wasn't fully rolled back
        await queryRunner.manager.delete(EmbeddableAssignmentModel, {
          id: inserted.id,
        });
      }
      throw err;
    } finally {
      await queryRunner.release();
    }

    return await EmbeddableAssignmentModel.findOne({
      where: {
        id: assignmentId,
      },
      relations: {
        questions: {
          question: true,
        },
      }
    });
  }

  /**
   * Creates associated assignment-question entries for the given parameters. Will create questions if they do not exist yet.
   *
   * @param courseId The course that questions should live in.
   * @param assignmentId The assignment that the questions are for.
   * @param questions The questions (which could include creation parameters, or just an ID to associate with) to be associated
   * @param entityManager Optional entity manager to pass in, in the case it is running in a transaction (as it is in typical invocation)
   * @private
   */
  private async associateQuestions(
    courseId: number,
    assignmentId: number,
    questions: UpsertEmbeddableAssignmentQuestionParams[],
    entityManager?: EntityManager,
  ) {
    if (!entityManager)
      entityManager = this.dataSource.manager;

    const questionRepo = entityManager.getRepository(EmbeddableQuestionModel)
    const assignmentQuestionRepo = entityManager.getRepository(EmbeddableAssignmentQuestionModel)

    const newQuestions = questions
      .filter(q => q.questionId === null || q.questionId === undefined)
    const existingQuestions = questions
      .filter(q => q.questionId !== null && q.questionId !== undefined)

    const alreadyExist = await assignmentQuestionRepo.find({
      where: {
        assignmentId,
      }
    });
    const toDelete = alreadyExist.filter(v => !existingQuestions.some(q => q.questionId === v.questionId))
    const deleteIds = toDelete.map(v => v.questionId);
    await assignmentQuestionRepo.delete({
      questionId: In(deleteIds),
    });
    await questionRepo.delete({
      isWeak: true,
      id: In(deleteIds)
    });

    const embeddableQuestionParams: DeepPartial<EmbeddableQuestionModel>[] = []
    let current = 0;
    const baseCount = await questionRepo.count({
      where: {
        courseId,
      }
    })
    newQuestions.forEach((q) => {
      embeddableQuestionParams.push({
        courseId,
        name: q.createParams?.name || `Question ${baseCount+current}`,
        ...(q.createParams ?? {}),
        isWeak: true,
      })
      current++;
    })

    const created = await questionRepo.save(embeddableQuestionParams);

    const embeddableAssignmentQuestionParams: DeepPartial<EmbeddableAssignmentQuestionModel>[] = []
    existingQuestions.forEach((q) =>
      embeddableAssignmentQuestionParams.push({
        assignmentId,
        questionId: q.questionId,
        order: q.order,
      })
    )
    newQuestions.forEach((q,i) =>
      embeddableAssignmentQuestionParams.push({
        assignmentId,
        questionId: created[i].id,
        order: q.order,
      })
    );

    return await assignmentQuestionRepo.save(embeddableAssignmentQuestionParams);
  }

  /**
   * Deletes the assignment with the given ID, and optionally any associated questions.
   *
   * @param assignmentId The assignment to be deleted
   */
  async delete(
    assignmentId: number
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const em = queryRunner.manager;

      const assignmentRepo = em.getRepository(
        EmbeddableAssignmentModel,
      );
      const questionRepo = em.getRepository(
        EmbeddableQuestionModel,
      )

      const assignment = await assignmentRepo.findOne({
        where: {
          id: assignmentId,
        },
        relations: {
          questions: {
            question: true,
          },
        }
      })

      await questionRepo.delete({
        id: In(assignment.questions.filter(v => v.question.isWeak).map(v => v.questionId))
      })

      await assignmentRepo.delete({
        id: assignmentId,
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      if (queryRunner.isTransactionActive && !queryRunner.isReleased) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtains feedback & a preliminary grade for a response to an embeddable question
   *
   * @param submission The submission to obtain feedback for
   * @param assignmentId The assignment the submission is for
   * @param questionId The question, as part of the assignment, that the submission is for
   * @param courseId The course in which the question resides
   * @param userId The user ID of the invoking user
   */
  async getFeedback(
    submission: string,
    assignmentId: number,
    questionId: number,
    courseId: number,
    userId: number,
  ): Promise<EmbeddableAssignmentFeedbackModel> {
    return await this.embeddableModuleService.getFeedback(
      EmbeddableAssignmentModel.getRepository(),
      {
        id: assignmentId
      },
      EmbeddableAssignmentFeedbackModel.getRepository(),
      courseId,
      submission,
      (item) => item.questions.find(v => v.questionId == questionId).question,
      {
        questionId,
        assignmentId,
        userId,
      },
      {
        questions: {
          question: true,
        }
      }
    );
  }

  /**
   * Retrieves feedback for the given assignment, and users, if provided
   * @param assignmentId
   * @param questionId (Optional) Specific question to receive answers for
   * @param users (Optional) IDs for users to pull data for
   */
  async getAnswers(assignmentId: number, questionId?: number, users?: number[]): Promise<EmbeddableAssignmentFeedbackModel[]> {
    return await this.embeddableModuleService.getAnswers(
      EmbeddableAssignmentFeedbackModel.getRepository(),
      {
        assignmentId,
        questionId,
      },
      {
        user: true,
        assignmentQuestion: {
          question: true,
        }
      },
      users,
    )
  }

  /**
   * Updates feedback with the given answerId with the provided parameters
   * @param answerId
   * @param params
   */
  async updateAnswer(answerId: number, params: UpdateEmbeddableFeedbackParams): Promise<EmbeddableAssignmentFeedbackModel> {
    return await this.embeddableModuleService.updateAnswer(EmbeddableAssignmentFeedbackModel.getRepository(), answerId, params);
  }

  /**
   * Deletes feedback with the given answerId
   * @param answerId
   */
  async deleteAnswer(answerId: number) {
    await this.embeddableModuleService.deleteAnswer(EmbeddableAssignmentFeedbackModel.getRepository(), answerId);
  }

  /**
   * Exports embeddable assignment results from the provided course constrained to the given parameters
   *
   * @param courseId The course to export question data from
   * @param assignmentId The assignment to export data from
   * @param includeAiFeedback Whether to include AI assessment feedback
   * @param includeNonSubmitters Whether to include ALL students in the course, or just those who submitted, for each question
   *
   * @returns Promise<Blob> A promise which evaluates to a Blob with buffer data that can be used to reconstruct an Excel sheet
   */
  async exportFeedback(
    courseId: number,
    assignmentId: number,
    includeAiFeedback: boolean,
    includeNonSubmitters: boolean,
  ): Promise<ExcelJS.Buffer> {
    const questions = (await EmbeddableAssignmentQuestionModel.find({
      where: {
        assignmentId,
      },
      order: {
        order: 'ASC',
      },
      relations: {
        question: {
          submissions: {
            user: true,
          }
        }
      }
    })).map((aq) => aq.question);

    return await this.embeddableModuleService.buildExcel(
      courseId,
      questions,
      includeNonSubmitters,
      includeAiFeedback
    )
  }
}