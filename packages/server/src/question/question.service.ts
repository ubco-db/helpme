import {
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  LimboQuestionStatus,
  OpenQuestionStatus,
  parseTaskIdsFromQuestionText,
  QuestionStatus,
  Role,
  StudentAssignmentProgress,
  StudentTaskProgress,
  waitingStatuses,
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
import { QuestionModel } from './question.entity';
import { QueueModel } from '../queue/queue.entity';
import { StudentTaskProgressModel } from 'studentTaskProgress/studentTaskProgress.entity';
import { QueueService } from '../queue/queue.service';
import { RedisQueueService } from '../redisQueue/redis-queue.service';
import { QueueChatService } from 'queueChats/queue-chats.service';

@Injectable()
export class QuestionService {
  constructor(
    private notifService: NotificationService,
    public queueService: QueueService,
    public redisQueueService: RedisQueueService,
    public readonly queueChatService: QueueChatService,
  ) {}

  async changeStatus(
    status: QuestionStatus,
    question: QuestionModel,
    userId: number,
    myRole: Role.STUDENT | Role.TA,
  ): Promise<void> {
    const oldStatus = question.status;
    const newStatus = status;
    // If the taHelped is already set, make sure the same ta updates the status
    if (
      myRole === Role.TA &&
      question.taHelped &&
      question.taHelped.id !== userId
    ) {
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

    const isBecomingHelped =
      oldStatus !== OpenQuestionStatus.Helping &&
      newStatus === OpenQuestionStatus.Helping;
    const isBecomingClosedFromWaiting =
      waitingStatuses.includes(oldStatus) && newStatus in ClosedQuestionStatus;
    const isDoneBeingHelped =
      oldStatus === OpenQuestionStatus.Helping &&
      newStatus !== OpenQuestionStatus.Helping &&
      question.helpedAt;
    const isBecomingPaused =
      oldStatus !== OpenQuestionStatus.Paused &&
      newStatus === OpenQuestionStatus.Paused;
    const isBecomingWaiting =
      !waitingStatuses.includes(oldStatus) &&
      waitingStatuses.includes(newStatus);
    const isResolving = newStatus === ClosedQuestionStatus.Resolved;
    const isFirstHelped = isBecomingHelped && !question.firstHelpedAt;

    const validTransition = question.changeStatus(newStatus, myRole);
    if (!validTransition) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.questionController.updateQuestion.fsmViolation(
          myRole,
          oldStatus,
          newStatus,
        ),
      );
    }

    // Set TA as taHelped when the TA starts helping the student
    const now = new Date();
    if (isBecomingHelped || isBecomingClosedFromWaiting) {
      question.taHelped = await UserModel.findOne({ where: { id: userId } });
      question.helpedAt = now;
      if (!question.lastReadyAt) {
        // failsafe in case for some reason lastReadyAt isn't set
        question.lastReadyAt = question.createdAt;
      }
      question.waitTime =
        question.waitTime +
        Math.round((now.getTime() - question.lastReadyAt.getTime()) / 1000);

      // Set firstHelpedAt if it hasn't already
      if (!question.firstHelpedAt) {
        question.firstHelpedAt = question.helpedAt;
      }
      await this.notifService.notifyUser(
        question.creatorId,
        NotifMsgs.queue.TA_HIT_HELPED(question.taHelped.name),
      );
    }
    if (isBecomingWaiting) {
      question.lastReadyAt = now;
    }
    if (isDoneBeingHelped) {
      question.helpTime =
        question.helpTime +
        Math.round((now.getTime() - question.helpedAt.getTime()) / 1000);
    }
    if (isBecomingPaused) {
      if (question.taHelpedId != userId) {
        question.taHelped = await UserModel.findOne({ where: { id: userId } });
      }
      await this.notifService.notifyUser(
        question.creatorId,
        NotifMsgs.queue.PAUSED(question.taHelped.name),
      );
    }

    if (newStatus in ClosedQuestionStatus) {
      question.closedAt = now;
    }
    if (newStatus in LimboQuestionStatus) {
      // depends on if the question was passed in with its group preloaded
      if (question.group) question.group = null;
      else question.groupId = null;
    }

    // For Queue Chats
    try {
      if (isResolving) {
        // Save chat metadata in database (if messages were exchanged)
        try {
          await this.queueChatService.endChat(question.queueId, question.id);
        } catch {
          // endChat will throw an error if the chat doesn't exist, and we don't want to prevent the question from being resolved
          // so just clear the chat metadata
          await this.queueChatService.clearChat(question.queueId, question.id);
        }
      } else if (newStatus in ClosedQuestionStatus) {
        // Don't save chat metadata in database
        await this.queueChatService.clearChat(question.queueId, question.id);
      } else if (isFirstHelped) {
        // Create chat metadata in Redis
        await this.queueChatService.createChat(
          question.queueId,
          question.taHelped,
          question,
        );
      }
    } catch (err) {
      throw new HttpException(
        ERROR_MESSAGES.questionService.queueChatUpdateFailure,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
    const tasks = parseTaskIdsFromQuestionText(question.text);
    if (question.text && tasks.length === 0) {
      throw new BadRequestException(
        ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
      );
    }
    const queueId = question.queueId;

    let queue: QueueModel;
    try {
      queue = await QueueModel.findOneOrFail({
        where: {
          id: queueId,
        },
      });
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

  async checkIfValidTaskQuestion(
    question: QuestionModel,
    queue: QueueModel,
  ): Promise<void> {
    if (
      question.isTaskQuestion &&
      question.status !== ClosedQuestionStatus.ConfirmedDeleted &&
      question.status !== ClosedQuestionStatus.DeletedDraft &&
      question.status !== ClosedQuestionStatus.Stale &&
      question.text
    ) {
      const tasks = parseTaskIdsFromQuestionText(question.text);
      if (tasks.length === 0) {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.studentTaskProgress.taskParseError,
        );
      }
      // check to make sure all tasks are in the config
      const configTasks = queue.config?.tasks;
      if (!configTasks) {
        throw new BadRequestException(
          ERROR_MESSAGES.questionController.studentTaskProgress.configDoesNotExist,
        );
      }
      for (const task of tasks) {
        if (!configTasks.hasOwnProperty(task)) {
          throw new BadRequestException(
            ERROR_MESSAGES.questionController.studentTaskProgress.taskNotInConfig,
          );
        }
      }
    }
  }

  async resolveQuestions(queueId: number, helperId: number): Promise<void> {
    const queue = await QueueModel.findOneOrFail({
      where: {
        id: queueId,
      },
    });
    const questions = await QuestionModel.find({
      where: {
        queueId,
        taHelpedId: helperId,
        status: OpenQuestionStatus.Helping,
      },
    });
    for (const question of questions) {
      if (question.isTaskQuestion) {
        await this.checkIfValidTaskQuestion(question, queue);
        await this.markTasksDone(question, question.creatorId);
      }
      await this.changeStatus(
        ClosedQuestionStatus.Resolved,
        question,
        helperId,
        Role.TA,
      );
    }
    // update redis
    const queueQuestions = await this.queueService.getQuestions(queueId);
    await this.redisQueueService.setQuestions(`q:${queueId}`, queueQuestions);
  }
}
