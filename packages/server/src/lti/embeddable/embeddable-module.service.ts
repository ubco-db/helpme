import { EmbeddableQuestionModel } from './question/embeddable-question.entity'
import * as ExcelJS from 'exceljs'
import { UserCourseModel } from '../../profile/user-course.entity'
import { UserModel } from '../../profile/user.entity'
import { EmbeddableQuestionFeedbackModel } from './question/embeddable-question-feedback.entity'
import { ERROR_MESSAGES, Role, UpdateEmbeddableFeedbackParams } from '@koh/common'
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import * as Sentry from '@sentry/nestjs'
import { ChatbotApiService } from '../../chatbot/chatbot-api.service'
import { DeepPartial, FindOptionsRelations, FindOptionsWhere, In, Repository } from 'typeorm'
import { EmbeddableAssignmentFeedbackModel } from './assignment/embeddable-assignment-feedback.entity'
import { EmbeddableAssignmentModel } from './assignment/embeddable-assignment.entity'

/**
 * General functions for the LTI Embeddable Model
 *
 * NOTE: This provider has no associated specification file as it contains generic functions which are tested by the invokers specification files
 */
@Injectable()
export class EmbeddableModuleService {
  constructor(
    private chatbotApiService: ChatbotApiService,
  ) {}

  /**
   * Updates feedback with the given answerId with the provided parameters
   *
   * @param repo The entity repository to use for updates
   * @param answerId The ID to use to find it
   * @param params The parameters to update it with
   */
  async updateAnswer<T extends EmbeddableQuestionFeedbackModel | EmbeddableAssignmentFeedbackModel>(repo: Repository<T>, answerId: number, params: UpdateEmbeddableFeedbackParams): Promise<T> {
    const feedback = await repo.findOne({
      where: {
        id: answerId,
      } as any
    });
    if (!feedback) {
      throw new NotFoundException(ERROR_MESSAGES.embeddableModule.feedbackNotFound);
    }
    Object.assign(feedback,params);
    return await repo.save(feedback);
  }

  /**
   * Retrieves feedback for the given assignment, and users, if provided
   *
   * @param repo The entity repository to use for retrieval
   * @param where The where clause for filtering based on the repository
   * @param relations The relations that should be included with the query
   * @param users (Optional) IDs for users to pull data for
   */
  async getAnswers<T extends EmbeddableQuestionFeedbackModel | EmbeddableAssignmentFeedbackModel>(
    repo: Repository<T>,
    where: FindOptionsWhere<T>,
    relations?: FindOptionsRelations<T>,
    users?: number[],
  ): Promise<T[]> {
    if (users && users.length > 0) {
      where = {
        ...where,
        userId: In(users)
      }
    }

    return await repo.find({
      where: where,
      relations: relations
    });
  }

  /**
   * Deletes feedback with the given answerId
   *
   * @param repo The entity repository to use for deletion
   * @param answerId The ID to use to find it
   */
  async deleteAnswer<T extends EmbeddableQuestionFeedbackModel | EmbeddableAssignmentFeedbackModel>(repo: Repository<T>, answerId: number): Promise<void> {
    await repo.delete({
      id: answerId,
    } as any);
  }

  /**
   * Obtains feedback based on an embeddable question and submission
   *
   * @param repo What entity repository to use to retrieve item
   * @param where Where clause of query
   * @param saveRepo The repository to save results to
   * @param courseId The course in which the question resides
   * @param obtainQuestion Function used to obtain the question used for getting feedback
   * @param submission The submission to obtain feedback for
   * @param saveParams The parameters to save the feedback entry with
   * @param relations (Optional) Relations to retrieve with initial query
   */
  async getFeedback<T1 extends EmbeddableQuestionModel | EmbeddableAssignmentModel, T2 extends EmbeddableQuestionFeedbackModel | EmbeddableAssignmentFeedbackModel>(
    repo: Repository<T1>,
    where: FindOptionsWhere<T1>,
    saveRepo: Repository<T2>,
    courseId: number,
    submission: string,
    obtainQuestion: (item: T1) => EmbeddableQuestionModel,
    saveParams: { assignmentId?: number, questionId: number, userId: number },
    relations?: FindOptionsRelations<T1>,
  ): Promise<T2> {
    const item = await repo.findOne({ where, relations });

    if (item.availableFrom && item.availableFrom.getTime() > Date.now()) {
      throw new UnauthorizedException(ERROR_MESSAGES.embeddableModule.notAvailableYet);
    } else if (item.availableUntil && item.availableUntil.getTime() < Date.now()) {
      throw new UnauthorizedException(ERROR_MESSAGES.embeddableModule.noLongerAvailable);
    }

    const question = obtainQuestion(item);

    const feedback = await this.chatbotApiService.queryChatbot(
      submission,
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
        submission,
        '',
        'grade',
        {
          question: question.questionText,
          criteria: question.criteriaText,
          feedback,
        },
        courseId
      );

      grade = Number(parseFloat(gradeResponse.match(/[+-]?\d+(\.\d+)?/g)[0]))
      if (isNaN(grade)) {
        grade = undefined;
        throw new Error('Grade response did not contain a valid numeric grade');
      }
    } catch (err) {
      console.error(`Failed to generate grade: ${err}`)
      Sentry.captureEvent(err);
    }

    const newEntity = saveRepo.create({
      ...saveParams,
      submission: submission,
      aiFeedback: feedback,
      aiGrade: grade,
    } as DeepPartial<T2>);
    return await saveRepo.save(newEntity)
  }
  /**
   * Builds an excel file export for a set of questions
   *
   * @param courseId
   * @param questionSet
   * @param includeNonSubmitters
   * @param includeAiFeedback
   */
  async buildExcel(
    courseId: number,
    questionSet: EmbeddableQuestionModel[],
    includeNonSubmitters: boolean,
    includeAiFeedback: boolean,
  ): Promise<ExcelJS.Buffer> {
    const wb = new ExcelJS.Workbook();
    const allStudents = includeNonSubmitters ? (await UserCourseModel.find({
        where: {
          courseId,
          role: Role.STUDENT
        },
        relations: {
          user: true,
        }
      })).map(u => u.user)
      : undefined

    function studentComparator(a: UserModel, b: UserModel) {
      const firstCompare = (a.firstName ?? '').localeCompare(b.firstName ?? '')
      if (firstCompare !== 0) return firstCompare
      return (a.lastName ?? '').localeCompare(b.lastName ?? '')
    }

    let index = 0;
    for (const question of questionSet) {
      const ws = wb.addWorksheet(question.name)

      let submitters = question.submissions
        .map(u => u.user)
      if (includeNonSubmitters) {
        submitters.push(...allStudents)
      }
      submitters = submitters.filter((v,i,a) => a.findIndex(u => u.id == v.id) == i)
      submitters.sort(studentComparator)

      const rows = []
      for (const student of submitters) {
        const potential = question.submissions
          .filter(s => s.userId == student.id)
          .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
        const match: EmbeddableQuestionFeedbackModel | undefined = potential[0];
        rows.push([
          student.firstName,
          student.lastName,
          student.sid?.toString() ?? '',
          student.email,
          match && match.createdAt ? match.createdAt : '',
          ...(includeAiFeedback ? [
            match?.aiGrade ? match.aiGrade / 100 : '',
            match?.aiFeedback
          ] : []),
          match?.humanGrade ? match.humanGrade / 100 : '',
          match?.humanFeedback ?? '',
        ]);
      }

      ws.addTable({
        name: `Table_${index+1}`,
        ref: 'A1',
        headerRow: true,
        style: {
          theme: 'TableStyleMedium4',
          showRowStripes: true,
        },
        columns: [
          { name: 'First Name' },
          { name: 'Last Name' },
          { name: 'Student Number' },
          { name: 'Email' },
          { name: 'Submitted' },
          ...(includeAiFeedback ? [
            { name: 'AI Grade' },
            { name: 'AI Feedback' },
          ] : []),
          { name: 'Grade' },
          { name: 'Feedback' }
        ],
        rows
      })
      ws.getColumn('E').numFmt = 'yyyy-mm-dd hh:mm:ss "GMT"'
      ws.getColumn('F').numFmt = '0.00%'
      ws.getRow(1).numFmt = undefined
      if (includeAiFeedback) {
        ws.getColumn('H').numFmt = '0.00%'
      }
      index++;
    }

    wb.clearThemes();
    return await wb.xlsx.writeBuffer();
  }
}