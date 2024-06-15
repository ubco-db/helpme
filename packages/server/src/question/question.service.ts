import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  QuestionStatus,
  Role,
  StudentAssignmentProgress,
  StudentTaskProgress,
} from '@koh/common';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  NotificationService,
  NotifMsgs,
} from 'notification/notification.service';
import { UserModel } from 'profile/user.entity';
import { Connection } from 'typeorm';
import { QuestionModel } from './question.entity';
import { QueueModel } from 'queue/queue.entity';
import { StudentTaskProgressModel } from 'studentTaskProgress/studentTaskProgress.entity';

@Injectable()
export class QuestionService {
  constructor(
    private connection: Connection,
    private notifService: NotificationService,
  ) {}

  async changeStatus(
    status: QuestionStatus,
    question: QuestionModel,
    userId: number,
  ): Promise<void> {
    const oldStatus = question.status;
    const newStatus = status;
    // If the taHelped is already set, make sure the same ta updates the status
    if (question.taHelped?.id !== userId) {
      if (oldStatus === OpenQuestionStatus.Helping) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.questionController.updateQuestion.otherTAHelping,
        );
      }
      if (oldStatus === ClosedQuestionStatus.Resolved) {
        throw new UnauthorizedException(
          ERROR_MESSAGES.questionController.updateQuestion.otherTAResolved,
        );
      }
    }

    const validTransition = question.changeStatus(newStatus, Role.TA);
    if (!validTransition) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.questionController.updateQuestion.fsmViolation(
          'TA',
          question.status,
          status,
        ),
      );
    }

    // Set TA as taHelped when the TA starts helping the student
    if (
      oldStatus !== OpenQuestionStatus.Helping &&
      newStatus === OpenQuestionStatus.Helping
    ) {
      question.taHelped = await UserModel.findOne(userId);
      question.helpedAt = new Date();

      // Set firstHelpedAt if it hasn't already
      if (!question.firstHelpedAt) {
        question.firstHelpedAt = question.helpedAt;
      }
      await this.notifService.notifyUser(
        question.creator.id,
        NotifMsgs.queue.TA_HIT_HELPED(question.taHelped.name),
      );
    }
    if (newStatus in ClosedQuestionStatus) {
      question.closedAt = new Date();
    }
    if (newStatus in LimboQuestionStatus) {
      // depends on if the question was passed in with its group preloaded
      if (question.group) question.group = null;
      else question.groupId = null;
    }
    try {
      await question.save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.questionController.saveQError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return;
  }

  async markTasksDone(question: QuestionModel, userId: number): Promise<void> {
    //
    // checks
    //
    if (!question.isTaskQuestion) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.notTaskQuestion,
      );
    }
    const tasks =
      question.text.match(/"(.*?)"/g)?.map((task) => task.slice(1, -1)) || [];
    if (tasks.length === 0) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
      );
    }
    const queueId = question.queueId;

    let queue: QueueModel;
    try {
      queue = await QueueModel.findOneOrFail(queueId);
    } catch (err) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.queueDoesNotExist,
      );
    }

    const jsonConfig = queue.config;
    if (!jsonConfig) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.configDoesNotExist,
      );
    }
    const assignmentName = jsonConfig.assignment_id;
    if (!assignmentName) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.assignmentDoesNotExist,
      );
    }

    const configTasks = jsonConfig.tasks;
    // check to make sure all tasks are in the config
    for (const task of tasks) {
      if (!configTasks.hasOwnProperty(task)) {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
        );
      }
    }

    //
    // now, create the studentTaskProgress
    //

    // get the studentTaskProgress for the student (if it exists already)
    const currentStudentTaskProgress: StudentTaskProgressModel =
      await StudentTaskProgressModel.findOne({
        where: {
          uid: userId,
          cid: queue.courseId,
        },
      });
    const currentTaskProgress = currentStudentTaskProgress?.taskProgress;

    let newTaskProgress: StudentTaskProgress;
    // if studentTaskProgress doesn't exist yet for the student, create it and append the new task
    if (
      currentStudentTaskProgress === undefined ||
      currentTaskProgress === undefined
    ) {
      const tempAssignmentProgress: StudentAssignmentProgress = {};
      for (const task of tasks) {
        tempAssignmentProgress[task] = { isDone: true };
      }
      newTaskProgress = {
        [assignmentName]: {
          lastEditedQueueId: queueId,
          assignmentProgress: tempAssignmentProgress,
        },
      };
      // if studentTaskProgress exists, but doesn't have anything for this assignment yet, create it
    } else if (currentTaskProgress[assignmentName] === undefined) {
      const tempAssignmentProgress = {};
      for (const task of tasks) {
        tempAssignmentProgress[task] = { isDone: true };
      }
      newTaskProgress = {
        ...currentTaskProgress,
        [assignmentName]: {
          lastEditedQueueId: queueId,
          assignmentProgress: tempAssignmentProgress,
        },
      };
      // if studentTaskProgress exists, check to see if each task is a new task
      // if it is a new task, append it to the studentTaskProgress
      // if it is an existing task, update the studentTaskProgress
    } else {
      newTaskProgress = currentTaskProgress;
      for (const task of tasks) {
        newTaskProgress[assignmentName].assignmentProgress[task] = {
          isDone: true,
        };
      }
      newTaskProgress[assignmentName].lastEditedQueueId = queueId;
    }

    try {
      await StudentTaskProgressModel.create({
        uid: userId,
        cid: queue.courseId,
        taskProgress: newTaskProgress,
      }).save();
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.questionController.saveQError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return;
  }

  async validateNotHelpingOther(
    newStatus: QuestionStatus,
    userId: number,
  ): Promise<void> {
    const isAlreadyHelpingOne =
      (await QuestionModel.count({
        where: {
          taHelpedId: userId,
          status: OpenQuestionStatus.Helping,
        },
      })) === 1;
    if (isAlreadyHelpingOne && newStatus === OpenQuestionStatus.Helping) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.updateQuestion.taHelpingOther,
      );
    }
  }
}
