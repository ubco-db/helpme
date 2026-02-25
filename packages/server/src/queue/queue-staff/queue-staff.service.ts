import {
  OpenQuestionStatus,
  StaffMember,
  ExtraTAStatus,
  GetQueueResponse,
  AlertType,
  ClosedQuestionStatus,
  LimboQuestionStatus,
  Role,
} from '@koh/common';
import {
  BadRequestException,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { QueueModel } from '../queue.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { QueueStaffModel } from './queue-staff.entity';
import { SchedulerRegistry, Cron, CronExpression } from '@nestjs/schedule';
import { AlertModel } from 'alerts/alerts.entity';
import async from 'async';
import { CronJob } from 'cron';
import { UserCourseModel } from 'profile/user-course.entity';
import { QuestionModel } from 'question/question.entity';
import { QuestionService } from 'question/question.service';
import { QueueService } from 'queue/queue.service';
import { RedisQueueService } from 'redisQueue/redis-queue.service';
import * as Sentry from '@sentry/node';

type StaffHelpingInOtherQueues = {
  queueId: number;
  userId: number;
  courseId: number;
  helpedAt: Date;
}[];

@Injectable()
export class QueueStaffService {
  constructor(
    // all made public for testing purposes
    public questionService: QuestionService,
    public schedulerRegistry: SchedulerRegistry,
    @Inject(forwardRef(() => QueueService))
    public queueService: QueueService,
    public redisQueueService: RedisQueueService,
    public dataSource: DataSource,
  ) { }

  /* Takes in QueueStaff[] and formats it for frontend consumption.
  Needs the following for getting StaffHelpingInOtherQueues (omit `courses: true` if you don't need it):
      relations: {
        queueStaff: {
          user: {
            courses: true,
          },
        },
      },
  */
  async getFormattedStaffList(queue: QueueModel): Promise<StaffMember[]> {
    if (
      !queue.queueStaff ||
      queue.queueStaff.length === 0 ||
      !queue.queueStaff[0].user
    ) {
      return [];
    }
    let StaffHelpingInOtherQueues = [];
    if (queue.queueStaff[0].user.courses) {
      // if the first user has any courses, it's assumed courses isn't undefined and thus included in the query
      StaffHelpingInOtherQueues = await this.getStaffHelpingInOtherQueues(
        queue.queueStaff[0].queueId,
      );
    }
    return queue.queueStaff.map((queueStaff) => {
      const staffHelpingInOtherQueue = StaffHelpingInOtherQueues.find(
        (staff) => staff.userId === queueStaff.userId,
      );
      // precedence: if user marked themselves away, show that, else show helping-in-other-* status
      return {
        id: queueStaff.userId,
        name: queueStaff.user.name,
        photoURL: queueStaff.user.photoURL,
        TANotes:
          queueStaff.user?.courses?.find(
            (ucm) => ucm.courseId === queue.courseId,
          )?.TANotes ?? '',
        extraStatus:
          queueStaff.extraTAStatus === ExtraTAStatus.AWAY
            ? ExtraTAStatus.AWAY
            : !staffHelpingInOtherQueue
              ? undefined
              : staffHelpingInOtherQueue.courseId !== queue.courseId
                ? ExtraTAStatus.HELPING_IN_ANOTHER_COURSE
                : staffHelpingInOtherQueue.queueId !== queue.id
                  ? ExtraTAStatus.HELPING_IN_ANOTHER_QUEUE
                  : undefined,
        helpingStudentInAnotherQueueSince: staffHelpingInOtherQueue?.helpedAt,
      };
    });
  }

  /* Some pieces of backend have their own QueueModel objects and just want to add on the proper staffList before sending to frontend
      Needs the following for getting StaffHelpingInOtherQueues (omit `courses: true` if you don't need it):
      relations: {
        queueStaff: {
          user: {
            courses: true,
          },
        },
      },
    */
  async formatStaffListPropertyForFrontend(
    rawQueue: QueueModel,
  ): Promise<GetQueueResponse> {
    const staffList = await this.getFormattedStaffList(rawQueue);
    const { queueStaff, ...queue } = rawQueue; // remove queueStaff property from QueueModel (rename to staffList for frontend)
    return {
      ...queue,
      staffList,
    };
  }

  /* Finds all staff members who are helping in other queues that ARE NOT the given queue.
     It also returns the question's helpedAt so you can display how long they have been helped for.
  */
  async getStaffHelpingInOtherQueues(
    queueId: number,
  ): Promise<StaffHelpingInOtherQueues> {
    // yes, this is joining the staff list table with itself. We start with the queueId of this queue and want to find which staff that are in this queue that are also checked into other queues.
    const query = `
    SELECT q.id AS "queueId", qstaff2."userId" AS "userId", q."courseId", question."helpedAt"
    FROM queue_staff_model AS qstaff1
    RIGHT JOIN queue_staff_model AS qstaff2 ON qstaff1."userId" = qstaff2."userId" AND qstaff2."queueId" != 19 
    LEFT JOIN queue_model AS q ON qstaff2."queueId" = q.id
    RIGHT JOIN question_model AS question ON question."queueId" = q.id AND question."taHelpedId" = qstaff2."userId" AND question.status = $1
    WHERE qstaff1."queueId" = $2
    `;
    const result = (await this.dataSource.query(query, [
      OpenQuestionStatus.Helping,
      queueId,
    ])) as StaffHelpingInOtherQueues;
    return result ? result : [];
  }

  async setTAExtraStatusForQueue(
    queueId: number,
    courseId: number,
    userId: number,
    status: ExtraTAStatus | null,
  ): Promise<void> {
    const allowedStatuses: Array<ExtraTAStatus | null> = [
      ExtraTAStatus.AWAY,
      null,
    ];
    if (!allowedStatuses.includes(status ?? null)) {
      throw new BadRequestException('Invalid status given');
    }

    const joinRow = await QueueStaffModel.findOne({
      where: { queueId, userId },
    });
    if (!joinRow) {
      throw new BadRequestException('Unable to set status');
    }

    const prev = joinRow.extraTAStatus;
    joinRow.extraTAStatus = status ?? null;
    await joinRow.save();

    if (
      prev !== ExtraTAStatus.AWAY &&
      joinRow.extraTAStatus === ExtraTAStatus.AWAY
    ) {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_MARKED_SELF_AWAY,
        userId,
        courseId,
        queueId,
      }).save();
    } else if (
      prev === ExtraTAStatus.AWAY &&
      (joinRow.extraTAStatus === null || joinRow.extraTAStatus === undefined)
    ) {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_MARKED_SELF_BACK,
        userId,
        courseId,
        queueId,
      }).save();
    }
  }

  async checkUserIn(
    userId: number,
    queueId: number,
    courseId: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existingQueueStaff = await manager.findOne(QueueStaffModel, {
        where: { queueId, userId },
      });
      if (existingQueueStaff) {
        return;
      }
      await manager
        .create(QueueStaffModel, {
          queueId,
          userId,
        })
        .save();

      await manager
        .create(EventModel, {
          time: new Date(),
          eventType: EventType.TA_CHECKED_IN,
          userId,
          courseId,
          queueId,
        })
        .save();
    });
  }

  async checkUserOut(
    userId: number,
    queueId: number,
    courseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existingQueueStaff = await manager.findOne(QueueStaffModel, {
      where: { queueId, userId },
    });
    // Do nothing if user not already in stafflist
    if (!existingQueueStaff) {
      return;
    }
    await manager.delete(QueueStaffModel, {
      queueId,
      userId,
    });

    await manager
      .create(EventModel, {
        time: new Date(),
        eventType: EventType.TA_CHECKED_OUT,
        userId,
        courseId,
        queueId,
      })
      .save();

    // if this was the last user to check out of the queue, disallow questions (idk what the purpose of that is exactly)
    // and prompt students to leave queue
    const queueStaffCount = await manager.count(QueueStaffModel, {
      where: { queueId },
    });
    if (queueStaffCount === 0) {
      await manager.update(QueueModel, queueId, {
        allowQuestions: false,
      });
      // (this needs to be after deleting the queue staff since this service also checks if the stafflist is empty)
      await this.promptStudentsToLeaveQueue(queueId, manager);
    }
  }

  async checkUserOutAll(
    userId: number,
    courseId: number,
    manager: EntityManager,
  ): Promise<void> {
    const existingQueueStaff = await manager.find(QueueStaffModel, {
      where: { userId },
    });
    if (!existingQueueStaff) {
      // not checked into any queues
      return;
    }

    for (const queueStaff of existingQueueStaff) {
      await this.checkUserOut(
        queueStaff.userId,
        queueStaff.queueId,
        courseId,
        manager,
      );
    }
  }

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
    await this.dataSource.transaction(async (manager) => {
      const queues = await QueueModel.find({ relations: { queueStaff: true } });

      queues.forEach(async (queue) => {
        queue.queueStaff.forEach(async (queueStaff) => {

          await EventModel.create({
            time: new Date(),
            eventType: EventType.TA_CHECKED_OUT_FORCED,
            userId: queueStaff.userId,
            courseId: queue.courseId,
            queueId: queue.id,
          }).save();
        });
        // Technically a bug that we don't have this but idk I kinda like how the behaviour is right now? (this would only add "Not accepting questions" tag to all queues, nothing else)
        // manager.update(QueueModel, queue.id, { allowQuestions: false });
        await manager.delete(QueueStaffModel, { queueId: queue.id });
      });
    });
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
    const queueStaffCount = await QueueStaffModel.count({ where: { queueId } });

    if (force || queueStaffCount === 0) {
      await this.unsafeClean(queueId);
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
  public async promptStudentsToLeaveQueue(
    queueId: number,
    manager: EntityManager,
  ): Promise<void> {
    // first, delete any existing cron jobs for this queue so that there's no name conflicts
    this.deleteAllLeaveQueueCronJobsForQueue(queueId);
    // firstly, make sure there are no staff checked in
    let staffList: { userId: number }[] = [];
    try {
      staffList = await manager.find(QueueStaffModel, {
        where: {
          queueId,
        },
      });
    } catch (err) {
      console.error('Error getting staffList', err);
      Sentry.captureException(err);
      return;
    }
    if (staffList && staffList.length > 0) {
      return;
    }
    // get all the students in the queue
    let students = await manager
      .createQueryBuilder(QueueModel, 'QueueModel')
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
        const existingAlert = await manager
          .createQueryBuilder(AlertModel, 'alert')
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
          .getOne();
        if (existingAlert) {
          return;
        }
        const alert = await manager
          .create(AlertModel, {
            alertType: AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE,
            sent: new Date(),
            userId: student.studentId,
            courseId: student.courseId,
            payload: { queueId, queueQuestionId: student.questionId },
          })
          .save();
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
        await this.dataSource.transaction(async (manager) => {
          await this.promptStudentsToLeaveQueue(queueId, manager);
        });
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
