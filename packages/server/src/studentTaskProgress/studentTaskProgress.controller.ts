import {
  AllStudentAssignmentProgress,
  Role,
  StudentAssignmentProgress,
  UserPartial,
} from '@koh/common';
import {
  Controller,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  Get,
  Param,
} from '@nestjs/common';
import { Roles } from 'decorators/roles.decorator';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { Connection, getRepository } from 'typeorm';
import { StudentTaskProgressModel } from './studentTaskProgress.entity';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { QueueRolesGuard } from 'guards/queue-role.guard';

@Controller('studentTaskProgress')
@UseGuards(JwtAuthGuard, CourseRolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StudentTaskProgressController {
  constructor(private connection: Connection) {}
  // TODO: make it so students can only retrieve their own taskProgress
  // maybe make 3 endpoints. getMyAssignmentProgress (using @UserId), getStudentAssignmentProgress (only usable by TAs. Though, maybe instead just ship the assignment progress with the task question itself), and getAllAssignmentProgressForQueue (also only used by TAs. This can be called initially to save a lot of the initial calls.), can also have getAllAssignmentProgressForCourse
  // will probably want to move the method to its own controller at that point (with a little note that mentions that the setting of taskProgress happens in the updateQuestion endpoint in the question controller).
  @Get('student/:userId/:courseId/:assignmentName')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getStudentAssignmentProgress(
    @Param('userId') userId: number,
    @Param('courseId') courseId: number,
    @Param('assignmentName') assignmentName: string,
  ): Promise<StudentAssignmentProgress | null> {
    const studentTaskProgress = await StudentTaskProgressModel.findOne({
      where: {
        uid: userId,
        cid: courseId,
      },
    });

    if (
      !studentTaskProgress ||
      !studentTaskProgress.taskProgress ||
      !studentTaskProgress.taskProgress[assignmentName]
    ) {
      return null;
    }

    const studentAssignmentProgress =
      studentTaskProgress.taskProgress[assignmentName].assignmentProgress;

    if (studentAssignmentProgress === undefined) {
      return null;
    }

    return studentAssignmentProgress;
  }

  /**
   * Retrieves the assignment progress for all students in a specific queue.
   *
   * It's probably a costly endpoint to call, thus don't call it often on the frontend.
   *
   * Getting only the studentAssignmentProgress for a specific queue is needed since some queues may have the same assignment loaded in them.
   */
  @Get('queue/:queueId/:courseId/:assignmentName')
  @UseGuards(QueueRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getAllAssignmentProgressForQueue(
    @Param('queueId') queueId: number,
    @Param('courseId') courseId: number,
    @Param('assignmentName') assignmentName: string,
  ): Promise<AllStudentAssignmentProgress> {
    // this returns the entire StudentTaskProgress for all students (which includes the assignment progress for stuff we don't care about)
    // TODO: figure out how to only select the needed columns from the join with user. Every way of adding the select statement causes a syntax error.
    const allStudentTaskProgressForQueue = await getRepository(
      StudentTaskProgressModel,
    )
      .createQueryBuilder('studentTaskProgress')
      .innerJoinAndSelect('studentTaskProgress.user', 'user')
      .where('studentTaskProgress.cid = :courseId', { courseId })
      .andWhere(
        `studentTaskProgress.taskProgress -> :assignmentName IS NOT NULL`,
        { assignmentName },
      )
      .andWhere(
        `studentTaskProgress.taskProgress -> :assignmentName ->> 'lastEditedQueueId' = :queueId`,
        { assignmentName, queueId },
      )
      .getMany();

    // this will be the object that we return, it's the student task progress for *only* this assignment (for this queue).
    // It also includes the user details for each student.
    const allStudentAssignmentProgressForQueue: AllStudentAssignmentProgress =
      {};

    allStudentTaskProgressForQueue.forEach((myStudentTaskProgress) => {
      const user = myStudentTaskProgress.user;
      const userPartial: UserPartial = {
        id: user.id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        sid: user.sid,
      };

      allStudentAssignmentProgressForQueue[user.id] = {
        userDetails: userPartial,
        assignmentProgress:
          myStudentTaskProgress.taskProgress[assignmentName].assignmentProgress,
      };
    });

    return allStudentAssignmentProgressForQueue;
  }
}
