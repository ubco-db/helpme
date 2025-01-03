import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CalendarStaffModel } from './calendar-staff.entity';
import { EntityManager } from 'typeorm';
import { UserModel } from '../profile/user.entity';
import { CalendarModel } from './calendar.entity';
import { AlertModel } from '../alerts/alerts.entity';
import { AlertType, ERROR_MESSAGES } from '@koh/common';
import { QueueModel } from '../queue/queue.entity';
import { EventModel, EventType } from '../profile/event-model.entity';
import { CronJob } from 'cron';
import * as Sentry from '@sentry/browser';
import { QuestionService } from '../question/question.service';
import { QueueCleanService } from 'queue/queue-clean/queue-clean.service';

@Injectable()
export class CalendarService implements OnModuleInit {
  constructor(
    private schedulerRegistry: SchedulerRegistry,
    public questionService: QuestionService, // needed to make public for jest testing purposes
    public queueCleanService: QueueCleanService,
  ) {}

  async onModuleInit() {
    await this.resetAutoCheckoutJobs();
  }

  /** save the calendar staff model (for many to many relationship) */
  async createCalendarStaff(
    userId: number,
    calendar: CalendarModel,
    transactionalEntityManager: EntityManager,
  ) {
    // make sure the user exists
    const user = await transactionalEntityManager.findOne(UserModel, userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await transactionalEntityManager.save(CalendarStaffModel, {
      userId,
      calendarId: calendar.id,
    });
  }

  async deleteAllCalendarStaffForCalendar(
    calendarId: number,
    transactionalEntityManager: EntityManager,
  ) {
    await transactionalEntityManager.delete(CalendarStaffModel, { calendarId });
  }

  /**
  Creates a new Cron job with name based on the userId and calendarId.

  Note that there is an image in docs/diagrams called TA_Auto_Checkout_Logic_flowchart.png
  that describes the logic of this.
  */
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
    if (
      (!daysOfWeek || (Array.isArray(daysOfWeek) && daysOfWeek.length === 0)) &&
      !startDate &&
      !endDate
    ) {
      if (skipEventsInPast && endDate < new Date()) {
        return;
      }
      if (endTime < new Date()) {
        throw new BadRequestException(ERROR_MESSAGES.calendarEvent.dateInPast);
      }
      jobInterval = endTime;
    } else if (daysOfWeek && daysOfWeek.length > 0 && startDate && endDate) {
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
      Sentry.captureMessage(
        'Invalid event in createAutoCheckoutCronJob:' +
          JSON.stringify({
            userId,
            calendarId,
            startDate,
            endDate,
            endTime,
            daysOfWeek: daysOfWeek,
            courseId,
          }),
      );
      throw new BadRequestException(ERROR_MESSAGES.calendarEvent.invalidEvent);
    }

    const job = new CronJob(jobInterval, async () => {
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
      // make sure the userId and the calendarId exist. If not, goodbye
      await UserModel.findOneOrFail(userId).catch(() => {
        this.deleteAutoCheckoutCronJob(userId, calendarId);
        return;
      });
      await CalendarModel.findOneOrFail(calendarId).catch(() => {
        this.deleteAutoCheckoutCronJob(userId, calendarId);
        return;
      });
      // otherwise, initialize the auto-checkout loop
      this.initializeAutoCheckout(userId, calendarId, courseId);
    });
    try {
      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
    } catch (err) {
      console.error('Error adding cron job', err);
      Sentry.captureException(err);
    }
  }

  async deleteAutoCheckoutCronJob(
    userId: number,
    calendarId: number,
    skipIfNotExists = false,
  ) {
    const jobName = `auto-checkout-${userId}-${calendarId}`;
    const cronJobs = this.schedulerRegistry.getCronJobs();
    if (!cronJobs.has(jobName)) {
      if (!skipIfNotExists) {
        console.error(`Cron job with name ${jobName} does not exist`);
        Sentry.captureMessage(`Cron job with name ${jobName} does not exist`);
      }
      return;
    }
    try {
      this.schedulerRegistry.deleteCronJob(jobName);
      console.log(`Deleted cron job with name ${jobName}`);
    } catch (err) {
      console.error(`Error deleting cron job with name ${jobName}`, err);
      Sentry.captureException(err);
    }
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
      this.sendAlertToAutoCheckout10minsFromNow(
        userId,
        calendarId,
        courseId,
        true,
      );
    }
  }

  async sendAlertToAutoCheckout10minsFromNow(
    userId: number,
    calendarId: number,
    courseId: number,
    firstTime = false,
  ) {
    const now = new Date();
    const tenMinutes = 10 * 60 * 1000;
    const nowPlus10Mins = new Date(now.getTime() + tenMinutes);
    const jobName = `auto-checkout-loop-${userId}-${calendarId}`;
    // send an alert
    let alert: AlertModel | null = null;
    try {
      alert = await AlertModel.create({
        alertType: AlertType.EVENT_ENDED_CHECKOUT_STAFF,
        sent: now,
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
    if (!firstTime) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }
    const job = new CronJob(nowPlus10Mins, async () => {
      this.autoCheckout(userId, calendarId, courseId, alert.id);
    });
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
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
  async autoCheckout(
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
        for (const queue of myCheckedInQueues) {
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
          // prompt students with questions to leave the queue
          await this.queueCleanService.promptStudentsToLeaveQueue(
            queue.queueId,
          );
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
        }
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
        // this cron job runs 10mins from the resolve date
        const job = new CronJob(nextRun, async () => {
          // initiate logic to auto-checkout 10mins from the resolve date
          this.sendAlertToAutoCheckout10minsFromNow(
            userId,
            calendarId,
            courseId,
          );
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
}
