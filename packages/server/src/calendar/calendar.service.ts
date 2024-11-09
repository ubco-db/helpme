import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CalendarStaffModel } from './calendar-staff.entity';
import {
  CalendarStaff,
  CalendarStaffRedisService,
} from './calendar-staff-redis.service';
import { createQueryBuilder, EntityManager, In } from 'typeorm';
import { UserModel } from 'profile/user.entity';
import { CalendarModel } from './calendar.entity';
import { AlertModel } from 'alerts/alerts.entity';
import {
  AlertType,
  ClosedQuestionStatus,
  ERROR_MESSAGES,
  OpenQuestionStatus,
} from '@koh/common';
import { QueueModel } from 'queue/queue.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { CronJob } from 'cron';
import * as Sentry from '@sentry/browser';
import { QuestionModel } from 'question/question.entity';
import { QuestionService } from 'question/question.service';

@Injectable()
export class CalendarService implements OnModuleInit {
  constructor(
    // private readonly calStaffRedisService: CalendarStaffRedisService,
    private schedulerRegistry: SchedulerRegistry,
    private questionService: QuestionService,
  ) {}

  async onModuleInit() {
    await this.initializeCache();
    await this.resetAutoCheckoutJobs();
  }

  async initializeCache() {
    console.log('Initializing calendar staff into redis cache');
    const calendarStaff = await createQueryBuilder(CalendarStaffModel)
      .select([
        'CalendarStaffModel.userId AS userId',
        'CalendarStaffModel.calendarId AS calendarId',
        'staff.firstName || staff.lastName AS username',
        'calendar.startDate',
        'calendar.endDate',
        'calendar.start AS startTime',
        'calendar.end AS endTime',
        'calendar.daysOfWeek',
        'calendar.course AS courseId',
      ])
      .leftJoin(UserModel, 'staff', 'staff.id = CalendarStaffModel.userId')
      .leftJoin(
        CalendarModel,
        'calendar',
        'calendar.id = CalendarStaffModel.calendarId',
      )
      .getRawMany<CalendarStaff>();
    // await this.calStaffRedisService.setAllCalendarStaff(
    //   'calendar-staff',
    //   calendarStaff,
    // );
    return calendarStaff;
  }

  /** save the calendar staff model (for many to many relationship) */
  async createCalendarStaff(
    userId: number,
    calendar: CalendarModel,
    transactionalEntityManager: EntityManager,
  ) {
    // make sure the user and the calendar event exist (while also retrieving some data to put inside redis)
    const user = await transactionalEntityManager
      .createQueryBuilder(UserModel, 'staff')
      .select('staff.firstName || staff.lastName AS name')
      .where('staff.id = :userId', { userId })
      .getRawOne<{ name: string }>();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await transactionalEntityManager.save(CalendarStaffModel, {
      userId,
      calendarId: calendar.id,
    });
    // get the user and calendar data to store in redis
    const calendarStaff: CalendarStaff = {
      userId,
      calendarId: calendar.id,
      courseId: calendar.course.id,
      username: user.name,
      startDate: calendar.startDate,
      endDate: calendar.endDate,
      startTime: calendar.start,
      endTime: calendar.end,
      daysOfWeek: calendar.daysOfWeek,
    };
    // await this.calStaffRedisService.setCalendarStaff(
    //   'calendar-staff',
    //   calendarStaff,
    // );
  }

  // TODO: updateCalendarStaff

  /** delete the calendar staff model (for many to many relationship) */
  async deleteCalendarStaff(
    userId: number,
    calendarId: number,
    calendarAlreadyDeleted = false,
  ) {
    if (!calendarAlreadyDeleted) {
      await CalendarStaffModel.delete({ userId, calendarId });
    }
    // await this.calStaffRedisService.deleteCalendarStaff(
    //   'calendar-staff',
    //   userId,
    //   calendarId,
    // );
  }

  // So every time a calendar-staff is created, it gets added to redis
  // Every 10 minutes, cycle through all calendar-staff and send an alert that they are going to be auto-checked out (or just check them out).
  // @Cron(CronExpression.EVERY_10_MINUTES)
  // async autoCheckOutStaff() {
  //   // Check the length of the redis keys. If 0, re-initialize the cache
  //   let redisCount =
  //     await this.calStaffRedisService.getKeyCount('calendar-staff');
  //   if (redisCount === 0) {
  //     await this.initializeCache();
  //   }
  //   // If still 0 (as in no events have any staff assigned to them), just return
  //   redisCount = await this.calStaffRedisService.getKeyCount('calendar-staff');
  //   if (redisCount === 0) {
  //     return;
  //   }
  //   const allCalendarStaff =
  //     await this.calStaffRedisService.getCalendarStaff('calendar-staff');
  //   // Perform the auto-checkout logic using the data from Redis
  //   console.log('calendarStaff' + JSON.stringify(allCalendarStaff));
  //   Object.values(allCalendarStaff).forEach(async (calendarStaff) => {
  //     console.log('staff' + JSON.stringify(calendarStaff));

  //     // apparently typeORM doesn't really provide a nice way to *only* query the @JoinTable() stafflist
  //     // thus, i will use a raw query
  //     const query = `
  //       SELECT "queueModelId" AS queueId
  //       FROM queue_model_staff_list_user_model
  //       WHERE "userModelId" = $1
  //       `;
  //     const myCheckedInQueues: { queueId: number }[] = await QueueModel.query(
  //       query,
  //       [calendarStaff.userId],
  //     );

  //     if (myCheckedInQueues.length === 0) {
  //       return;
  //     }

  //     const anotherAlert = await AlertModel.findOne({
  //       where: {
  //         alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
  //         userId: calendarStaff.userId,
  //         resolved: null,
  //       },
  //     });

  //     // If the same user already has an alert for this then don't create a new one and instead checkout the TA
  //     if (anotherAlert) {
  //       const queuesWithCheckedInStaff: QueueModel[] =
  //         await QueueModel.getRepository().find({ relations: ['staffList'] });
  //       queuesWithCheckedInStaff.forEach(async (queue) => {
  //         queue.staffList.forEach(async (ta) => {
  //           await EventModel.create({
  //             time: new Date(),
  //             eventType: EventType.TA_CHECKED_OUT_EVENT_END,
  //             userId: ta.id,
  //             courseId: queue.courseId,
  //             queueId: queue.id,
  //           }).save();
  //         });
  //         queue.staffList = [];
  //       });
  //       await QueueModel.save(queuesWithCheckedInStaff);
  //     } else {
  //       const alert = await AlertModel.create({
  //         alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
  //         sent: new Date(),
  //         userId: calendarStaff.userId,
  //         courseId: calendarStaff.courseId,
  //         payload: {},
  //       }).save();
  //     }
  //   });
  // }

  // NOTE: scrapping everything above and isntead going to use dynamic cron jobs with nest.js
  // Not using redis
  /** Creates a new Cron job with name based on the userId and calendarId */
  async createAutoCheckoutCronJob(
    userId: number,
    calendarId: number,
    startDate: Date | null,
    endDate: Date | null,
    endTime: Date,
    daysOfWeek: string[],
    courseId: number,
    skipEventsInPast = false,
  ) {
    const jobName = `auto-checkout-${userId}-${calendarId}`;
    //// logic for creating jobInterval
    // if the event is a one-time event, then the daysOfWeek will be an empty array, and startDate and endDate will both be null
    // in which case, the cron job should simple happen at endDate
    let jobInterval: string | Date = '';
    if (daysOfWeek.length === 0 && !startDate && !endDate) {
      if (skipEventsInPast && endDate < new Date()) {
        return;
      }
      if (endTime < new Date()) {
        throw new BadRequestException(ERROR_MESSAGES.calendarEvent.dateInPast);
      }
      jobInterval = endTime;
    } else if (daysOfWeek.length > 0 && startDate && endDate) {
      // if the event is recurring
      /* From nest.js docs:
      * * * * * *
      | | | | | |
      | | | | | day of week
      | | | | months
      | | | day of month
      | | hours
      | minutes
      seconds (optional)
      */
      const sortedDaysOfWeek = daysOfWeek.sort();
      jobInterval = `${endTime.getMinutes()} ${endTime.getHours()} * * ${sortedDaysOfWeek.join(',')}`;
    } else {
      throw new BadRequestException(ERROR_MESSAGES.calendarEvent.invalidEvent);
    }

    const job = new CronJob(jobInterval, () => {
      // if startDate is in the future, then don't do anything
      if (startDate && startDate > new Date()) {
        return;
      }
      // if endDate is in the past, then delete this cron job
      if (endDate && endDate < new Date()) {
        // you have served your purpose, goodbye
        this.deleteAutoCheckoutCronJob(userId, calendarId);
        return;
      }
      // otherwise, initialize the auto-checkout loop
      this.initializeAutoCheckout(userId, calendarId, courseId);
    });
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
  }

  async deleteAutoCheckoutCronJob(userId: number, calendarId: number) {
    const jobName = `auto-checkout-${userId}-${calendarId}`;
    this.schedulerRegistry.deleteCronJob(jobName);
    console.log(`Deleted cron job with name ${jobName}`);
  }

  /**
   * Initializes the auto-checkout loop for a user (keep prompting the user every 10mins if they want to check out until they either don't respond or check out themselves)
   *
   * Since this gets ran in a cron job, I need to be strict about catching errors with sentry
   */
  async initializeAutoCheckout(
    userId: number,
    calendarId: number,
    courseId: number,
  ) {
    // first check if they are checked in
    // apparently typeORM doesn't really provide a nice way to *only* query the @JoinTable() stafflist
    // thus, i will use a raw query
    const query = `
          SELECT "queueModelId" AS queueId
          FROM queue_model_staff_list_user_model
          WHERE "userModelId" = $1
          `;

    let myCheckedInQueues: { queueModelId: number; userModelId: number }[] = [];
    try {
      myCheckedInQueues = await QueueModel.query(query, [userId]);
    } catch (err) {
      console.error('Error checking if user is checked in', err);
      Sentry.captureException(err);
      return;
    }

    // if they are checked in:
    // - send an alert to ask them if they want to check out
    // - then create a new cron job to be 10mins from now that checks if they have responded to the alert
    if (myCheckedInQueues && myCheckedInQueues.length > 0) {
      // send an alert
      let alert: AlertModel | null = null;
      try {
        alert = await AlertModel.create({
          alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
          sent: new Date(),
          userId: userId,
          courseId: courseId,
          payload: {},
        }).save();
      } catch (err) {
        console.error(
          'Error creating EVENT_ENDED_CHECKOUT_STAFF alert in cron job',
          err,
        );
        Sentry.captureException(err);
        return;
      }
      if (!alert) {
        console.error(
          'Error creating EVENT_ENDED_CHECKOUT_STAFF alert in cron job',
        );
        Sentry.captureMessage(
          'Error creating EVENT_ENDED_CHECKOUT_STAFF alert in cron job',
        );
        return;
      }
      // create the cron job (10mins from now)
      const jobName = `auto-checkout-loop-${userId}-${calendarId}`;
      const job = new CronJob(
        new Date(new Date().getTime() + 10 * 60 * 1000),
        () => {
          this.autoCheckoutResponseLoop(userId, calendarId, courseId, alert.id);
        },
      );
      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
    }
  }

  /**
   * Keep prompting the user every 10mins if they want to check out until they either don't respond or check out themselves
   * Allows the user to keep clicking "I need 10 more mins"
   *
   * Logic:
   * - check if the user is checked in
   *   - if not, return
   *   - if still checked in, check if alert is resolved
   *      - if not, check out the user
   *      - if resolved, check when resolved, and create a new cron job that calls this function again 10mins from the resolve date
   */
  async autoCheckoutResponseLoop(
    userId: number,
    calendarId: number,
    courseId: number,
    alertId: number,
  ) {
    // first check if they are checked in. If not then return
    const query = `
      SELECT "queueModelId" AS "queueId"
      FROM queue_model_staff_list_user_model
      WHERE "userModelId" = $1
      `;
    let myCheckedInQueues: { queueId: number }[] = [];
    try {
      myCheckedInQueues = await QueueModel.query(query, [userId]);
    } catch (err) {
      console.error('Error checking if user is checked in in cron job', err);
      Sentry.captureException(err);
      return;
    }

    // check if the user is checked in
    if (myCheckedInQueues && myCheckedInQueues.length > 0) {
      // get auto-checkout alert
      let alert: AlertModel | null = null;
      try {
        alert = await AlertModel.findOneOrFail({
          where: {
            id: alertId,
          },
        });
      } catch (err) {
        console.error('Error getting auto-checkout alert in cron job', err);
        Sentry.captureException(err);
        return;
      }

      // if the alert is not resolved, check out the user and stop helping any questions
      if (alert.resolved === null) {
        myCheckedInQueues.forEach(async (queue) => {
          // convert any helping questions to resolved
          try {
            await this.questionService.resolveQuestions(queue.queueId, userId);
          } catch (err) {
            console.error('Error resolving questions in cron job', err);
            Sentry.captureException(err);
            return;
          }
          // check them out with a DELETE query
          const query = `
            DELETE FROM queue_model_staff_list_user_model
            WHERE "queueModelId" = $1 AND "userModelId" = $2
            `;
          try {
            await QueueModel.query(query, [queue.queueId, userId]);
          } catch (err) {
            console.error('Error checking out user in cron job', err);
            Sentry.captureException(err);
            return;
          }
          // create a TA_CHECKED_OUT_EVENT_END event
          try {
            await EventModel.create({
              time: new Date(),
              eventType: EventType.TA_CHECKED_OUT_EVENT_END,
              userId: userId,
              courseId: courseId,
              queueId: queue.queueId,
            }).save();
          } catch (err) {
            console.error(
              'Error creating TA_CHECKED_OUT_EVENT_END event in cron job',
              err,
            );
            Sentry.captureException(err);
            return;
          }
        });
        // resolve the alert
        try {
          alert.resolved = new Date();
          await alert.save();
        } catch (err) {
          console.error('Error resolving auto-checkout alert in cron job', err);
          Sentry.captureException(err);
          return;
        }
      } else {
        // if the alert is resolved, check when resolved, and create a new cron job that calls this function again 10mins from the resolve date
        const now = new Date();
        const tenMinutes = 10 * 60 * 1000;
        const resolveDate = alert.resolved;
        const nextRun = new Date(resolveDate.getTime() + tenMinutes);
        if (now > nextRun) {
          // somehow, the alert was resolved *after* the 10min mark (When they should've been checked out)
          // in which case, catch error and return
          console.error(
            'Alert was somehow resolved after 10min mark in cron job',
          );
          Sentry.captureMessage(
            'Alert was somehow resolved after 10min mark in cron job',
          );
          return;
        }
        // create a new cron job
        const jobName = `auto-checkout-loop-${userId}-${calendarId}`;
        // delete the current cron job and add a new one
        this.schedulerRegistry.deleteCronJob(jobName);
        const job = new CronJob(nextRun, () => {
          this.autoCheckoutResponseLoop(userId, calendarId, courseId, alertId);
        });
        this.schedulerRegistry.addCronJob(jobName, job);
        job.start();
      }
    }
  }

  async clearAllAutoCheckoutJobs() {
    const jobs = this.schedulerRegistry.getCronJobs();
    for (const [name, job] of jobs) {
      if (
        name.startsWith('auto-checkout-') &&
        !name.startsWith('auto-checkout-loop-')
      ) {
        job.stop();
        this.schedulerRegistry.deleteCronJob(name);
      }
    }
  }

  async retroactivelyCreateAutoCheckoutJobs() {
    // get all calendar staff
    const calendarStaffList = await CalendarStaffModel.find({
      relations: ['calendar', 'calendar.course'],
    });
    // for each calendar staff, create a cron job
    for (const calendarStaff of calendarStaffList) {
      await this.createAutoCheckoutCronJob(
        calendarStaff.userId,
        calendarStaff.calendarId,
        calendarStaff.calendar.startDate,
        calendarStaff.calendar.endDate,
        calendarStaff.calendar.end,
        calendarStaff.calendar.daysOfWeek,
        calendarStaff.calendar.course.id, // I hate that i have to do it like this and have a join just for the courseId. Thanks typeorm </3
        true,
      );
    }
  }

  async resetAutoCheckoutJobs() {
    await this.clearAllAutoCheckoutJobs();
    console.log('Cleared all auto-checkout jobs');
    await this.retroactivelyCreateAutoCheckoutJobs();
    console.log('Retroactively created auto-checkout jobs');
  }

  // also add a service that will clear all old cron jobs with a particular calendar Id
  // as well as another that will clear all cron jobs with a particular userId (for when they get deleted)
  // somehow maybe add a database trigger for this?

  // TODO: on launch, restart all cron jobs (maybe)
}
