import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { createQueryBuilder } from 'typeorm';

/**
 * Works similarly to course-roles guard except it will grab the courseId from
 * the async question with the given questionId (or qid) parameter in the request
 */
@Injectable()
export class AsyncQuestionRolesGuard extends RolesGuard {
  async setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }> {
    const user: UserModel = await UserModel.findOne(request.user.userId, {
      relations: ['courses'],
    });
    // asnyc questionId given in the request parameter. Can be qid or questionId
    const questionId = request.params.qid ?? request.params.questionId ?? null;
    if (!questionId) {
      throw new NotFoundException(
        'Question id not found. Please ensure you are using the correct parameter name',
      );
    }

    // get the courseId from the async question
    const aq = await createQueryBuilder(AsyncQuestionModel)
      .select('"courseId"')
      .where('id = :questionId', { questionId })
      .getRawOne<{ courseId: number }>();

    if (!aq) {
      throw new NotFoundException('Async question not found');
    }

    return { courseId: aq.courseId, user };
  }
}
