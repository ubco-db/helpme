import { ERROR_MESSAGES } from '@koh/common';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';
import { QueueModel } from '../queue/queue.entity';

@Injectable()
export class QueueRolesGuard extends RolesGuard {
  async setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }> {
    const queue = await QueueModel.findOneBy({ id: request.params.queueId });
    if (!queue) {
      throw new NotFoundException(ERROR_MESSAGES.queueRoleGuard.queueNotFound);
    }
    const courseId = queue.courseId ?? request.params.cid ?? null;
    const user = await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
      relations: {
        courses: true,
      },
    });

    return { courseId, user };
  }
}
