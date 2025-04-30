import { Injectable } from '@nestjs/common';
import { RolesGuard } from './role.guard';
import { UserModel } from '../profile/user.entity';

@Injectable()
export class CourseRolesGuard extends RolesGuard {
  async setupData(
    request: any,
  ): Promise<{ courseId: number; user: UserModel }> {
    const user = await UserModel.findOne({
      where: {
        id: request.user.userId,
      },
      relations: {
        courses: true,
      },
    });
    const courseId =
      request.params.id ??
      request.params.courseId ??
      request.params.cid ??
      null;
    return { courseId, user };
  }
}
