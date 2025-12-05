import {
  AlertDeliveryMode,
  AlertType,
  ClosedQuestionStatus,
  LimboQuestionStatus,
  OpenQuestionStatus,
  Role,
} from '@koh/common';
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import async from 'async';
import { EventModel, EventType } from 'profile/event-model.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { QuestionModel } from '../../question/question.entity';
import { QueueModel } from '../queue.entity';
import { AlertModel } from '../../alerts/alerts.entity';
import { CronJob } from 'cron';
import * as Sentry from '@sentry/browser';
import { QuestionService } from 'question/question.service';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import { QueueService } from 'queue/queue.service';

/**
 * Clean the queue and mark stale
 */
@Injectable()
export class QueueCleanService {
  constructor(
    // all made public for testing purposes
    public questionService: QuestionService,
    public schedulerRegistry: SchedulerRegistry,
    public queueService: QueueService,
    public redisQueueService: RedisQueueService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanAllQueues(): Promise<void> {
    const queuesWithOpenQuestions: QueueModel[] =
      await QueueModel.getRepository()
        .createQueryBuilder('queue_model')
        .leftJoinAndSelect('queue_model.questions', 'question')
        .where('question.status IN (:...status)', {
          status: [
            ...Object.values(OpenQuestionStatus),
            ...Object.values(LimboQuestionStatus),
          ],
        })
        .getMany();

    // Clean 1 queue at a time
    await async.mapLimit(
      queuesWithOpenQuestions,
      1,
      async (queue) => await this.cleanQueue(queue.id, true),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async checkoutAllStaff(): Promise<void> {
    const queuesWithCheckedInStaff: QueueModel[] =
      await QueueModel.getRepository().find({ relations: ['staffList'] });

    queuesWithCheckedInStaff.forEach(async (queue) => {
      await queue.staffList.forEach(async (ta) => {
        await EventModel.create({
          time: new Date(),
          eventType: EventType.TA_CHECKED_OUT_FORCED,
          userId: ta.id,
          courseId: queue.courseId,
          queueId: queue.id,
        }).save();
      });
      queue.staffList = [];
    });
    await QueueModel.save(queuesWithCheckedInStaff);
  }

  // TODO: move this to a course-clean service or something. This is just here because
  // this feature was pushed out in a time crunch.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  public async cleanSelfEnrollOverrides(): Promise<void> {
    await UserCourseModel.delete({
      expires: true,
    });
  }

  public async cleanQueue(queueId: number, force?: boolean): Promise<void> {
    const queue = await QueueModel.findOne({
      where: { id: queueId },
      relations: ['staffList'],
    });

    if (force || queue.staffList.length === 0) {
      await this.unsafeClean(queue.id);
    }
  }

  private async unsafeClean(queueId: number): Promise<void> {
    const questions = await QuestionModel.inQueueWithStatus(queueId, [
      ...Object.values(OpenQuestionStatus),
      ...Object.values(LimboQuestionStatus),
    ]).getMany();
    const alerts = await AlertModel.createQueryBuilder('alert')
      .where('alert.resolved IS NULL')
      .andWhere("(alert.payload ->> 'queueId')::INTEGER = :queueId ", {
        queueId,
      })
      .andWhere('alert."deliveryMode" = :deliveryMode', {
        deliveryMode: AlertDeliveryMode.MODAL,
      })
      .getMany();

    questions.forEach((q: QuestionModel) => {
      q.status = ClosedQuestionStatus.Stale;
      q.closedAt = new Date();
    });
    alerts.forEach((a: AlertModel) => {
      a.resolved = new Date();
    });

    await QuestionModel.save(questions);
    await AlertModel.save(alerts);

    // update redis
    const queueQuestions = await this.queueService.getQuestions(queueId);
    await this.redisQueueService.setQuestions(`q:${queueId}`, queueQuestions);
  }

  /**
   * Prompts students to leave the queue if there are no staff checked in.
   * They are given 10mins to respond. They can either click "leave queue" or "stay"
   * If they do not respond in that 10mins, their questions are automatically marked as "LeftDueToNoStaff".
   * If they click "stay" in that first 10mins, they are given another 10 mins (for a total of 20) before this checks if there are staff checked in.
   * If there are still no staff checked in, the student will be prompted again with 10mins to respond (thus completing a loop).
   * This makes it so that even if they click "I'll stay" and forget, the system will clear their question.
   */
  public async promptStudentsToLeaveQueue(queueId: number): Promise<void> {
    // first, delete any existing cron jobs for this queue so that there's no name conflicts
    this.deleteAllLeaveQueueCronJobsForQueue(queueId);
    // firstly, make sure there are no staff checked in
    const query = `
    SELECT "userModelId" AS userId
    FROM queue_model_staff_list_user_model
    WHERE "queueModelId" = $1
    `;

    let staffList: { userId: number }[] = [];
    try {
      staffList = await QueueModel.query(query, [queueId]);
    } catch (err) {
      console.error('Error getting staffList', err);
      Sentry.captureException(err);
      return;
    }
    if (staffList && staffList.length > 0) {
      return;
    }
    // get all the students in the queue
    let students = await QueueModel.createQueryBuilder()
      .select('QuestionModel.creatorId', 'studentId')
      .addSelect('QueueModel.courseId', 'courseId')
      .addSelect('QuestionModel.id', 'questionId')
      .leftJoin(
        QuestionModel,
        'QuestionModel',
        '"QuestionModel"."queueId" = "QueueModel"."id"',
      )
      .where('QueueModel.id = :queueId', { queueId })
      .andWhere('QuestionModel.status IN (:...status)', {
        status: [
          ...Object.values(OpenQuestionStatus),
          ...Object.values(LimboQuestionStatus),
        ],
      })
      .getRawMany<{
        studentId: number;
        courseId: number;
        questionId: number;
      }>();

    // filter out duplicate students (if they have multiple questions in the queue). We only need to send them 1 alert
    students = students.filter(
      (student, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t.studentId === student.studentId &&
            t.courseId === student.courseId,
        ),
    );

    // create an alert for each student
    for (const student of students) {
      try {
        // first, make sure they don't already have an unresolved PROMPT_STUDENT_TO_LEAVE_QUEUE alert with this courseId and queueId
        const existingAlert = await AlertModel.createQueryBuilder('alert')
          .where('alert.userId = :userId', { userId: student.studentId })
          .andWhere('alert.courseId = :courseId', {
            courseId: student.courseId,
          })
          .andWhere('alert.alertType = :alertType', {
            alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
          })
          .andWhere('alert.resolved IS NULL')
          .andWhere('alert.payload::jsonb @> :payload', {
            payload: JSON.stringify({ queueId }),
          })
          .andWhere('alert."deliveryMode" = :deliveryMode', {
            deliveryMode: AlertDeliveryMode.MODAL,
          })
          .getOne();
        if (existingAlert) {
          return;
        }
        const alert = await AlertModel.create({
          alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
          sent: new Date(),
          userId: student.studentId,
          courseId: student.courseId,
          payload: {
            queueId,
            ...(student.questionId !== undefined
              ? { queueQuestionId: student.questionId }
              : {}),
          },
        }).save();
        // if the student does not respond in 10 minutes, resolve the alert and mark the question as LeftDueToNoStaff
        const jobName = `prompt-student-to-leave-queue-${queueId}-${student.studentId}`;
        const now = new Date();
        const nowPlus10Mins = new Date(now.getTime() + 10 * 60 * 1000);
        const job = new CronJob(nowPlus10Mins, async () => {
          await this.autoLeaveQueue(
            student.studentId,
            queueId,
            student.courseId,
            alert.id,
          );
        });
        this.schedulerRegistry.addCronJob(jobName, job);
        job.start();
      } catch (err) {
        console.error(
          'Error creating PROMPT_STUDENT_TO_LEAVE_QUEUE alert and/or cron job',
          err,
        );
        Sentry.captureException(err);
        return;
      }
    }
  }

  // made public for testing purposes
  public async autoLeaveQueue(
    userId: number,
    queueId: number,
    courseId: number,
    alertId: number,
  ) {
    // get the alert
    let alert: AlertModel | null = null;
    try {
      alert = await AlertModel.findOneOrFail({
        where: {
          id: alertId,
        },
      });
    } catch (err) {
      console.error('Error getting auto-leave-queue alert in cron job', err);
      Sentry.captureException(err);
      return;
    }
    // if the alert is not resolved, resolve the alert and mark the question as LeftDueToNoStaff
    if (alert.resolved === null) {
      // resolve the alert
      try {
        alert.resolved = new Date();
        await alert.save();
      } catch (err) {
        console.error(
          'Error resolving auto-leave-queue alert in cron job',
          err,
        );
        Sentry.captureException(err);
        return;
      }
      // mark the questions as LeftDueToNoStaff
      try {
        const questions = await QuestionModel.inQueueWithStatus(queueId, [
          ...Object.values(OpenQuestionStatus),
          ...Object.values(LimboQuestionStatus),
        ]).getMany();
        for (const q of questions) {
          await this.questionService.changeStatus(
            ClosedQuestionStatus.LeftDueToNoStaff,
            q,
            userId,
            Role.STUDENT,
          );
        }
        // update redis
        const queueQuestions = await this.queueService.getQuestions(queueId);
        await this.redisQueueService.setQuestions(
          `q:${queueId}`,
          queueQuestions,
        );
      } catch (err) {
        console.error(
          'Error marking question as LeftDueToNoStaff in cron job',
          err,
        );
        Sentry.captureException(err);
        return;
      }
      // you have served your purpose, delete this cron job
      this.schedulerRegistry.deleteCronJob(
        `prompt-student-to-leave-queue-${queueId}-${userId}`,
      );
    } else {
      // if the alert *is* resolved, then that means the student clicked that they wish to stay
      // in 10mins from now, check if there's any staff and prompt them again if they want to leave
      const jobName = `prompt-student-to-leave-queue-${queueId}-${userId}`;
      // delete old cron job
      this.schedulerRegistry.deleteCronJob(jobName);
      const now = new Date();
      const nowPlus10Mins = new Date(now.getTime() + 10 * 60 * 1000);
      const job = new CronJob(nowPlus10Mins, async () => {
        await this.promptStudentsToLeaveQueue(queueId);
      });
      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
    }
  }

  public deleteLeaveQueueCronJobForStudent(
    queueId: number,
    studentId: number,
  ): void {
    const jobs = this.schedulerRegistry.getCronJobs();
    // note that this has to be done this way.
    // Doing schedularRegistry.getCronJob(jobName) will error if the job is not found
    // same with doing schedulerRegistry.deleteCronJob(jobName)
    for (const [jobName, job] of jobs) {
      if (jobName === `prompt-student-to-leave-queue-${queueId}-${studentId}`) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    }
  }

  public deleteAllLeaveQueueCronJobsForQueue(queueId: number): void {
    const jobs = this.schedulerRegistry.getCronJobs();
    for (const [jobName, job] of jobs) {
      if (jobName.startsWith(`prompt-student-to-leave-queue-${queueId}-`)) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    }
  }

  public async resolvePromptStudentToLeaveQueueAlerts(
    queueId: number,
  ): Promise<void> {
    const alerts = await AlertModel.createQueryBuilder('alert')
      .where('alert.alertType = :alertType', {
        alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
      })
      .andWhere('alert.resolved IS NULL')
      .andWhere('alert.payload::jsonb @> :payload', {
        payload: JSON.stringify({ queueId }),
      })
      .getMany();

    alerts.forEach(async (alert) => {
      alert.resolved = new Date();
      await alert.save();
    });
  }
}
