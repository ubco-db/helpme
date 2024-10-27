import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarStaffModel } from './calendar-staff.entity';
import {
  CalendarStaff,
  CalendarStaffRedisService,
} from './calendar-staff-redis.service';
import { createQueryBuilder, EntityManager } from 'typeorm';
import { UserModel } from 'profile/user.entity';
import { CalendarModel } from './calendar.entity';

@Injectable()
export class CalendarService implements OnModuleInit {
  constructor(
    private readonly calStaffRedisService: CalendarStaffRedisService,
  ) {}

  async onModuleInit() {
    await this.initializeCache();
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
      ])
      .leftJoin(UserModel, 'staff', 'staff.id = CalendarStaffModel.userId')
      .leftJoin(
        CalendarModel,
        'calendar',
        'calendar.id = CalendarStaffModel.calendarId',
      )
      .getRawMany<CalendarStaff>();
    await this.calStaffRedisService.setAllCalendarStaff(
      'calendar-staff',
      calendarStaff,
    );
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
      username: user.name,
      startDate: calendar.startDate,
      endDate: calendar.endDate,
      startTime: calendar.start,
      endTime: calendar.end,
      daysOfWeek: calendar.daysOfWeek,
    };
    await this.calStaffRedisService.setCalendarStaff(
      'calendar-staff',
      calendarStaff,
    );
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
    await this.calStaffRedisService.deleteCalendarStaff(
      'calendar-staff',
      userId,
      calendarId,
    );
  }

  // So every time a calendar-staff is created, it gets added to redis
  // Every 10 minutes, cycle through all calendar-staff and send an alert that they are going to be auto-checked out (or just check them out).
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCheckOutStaff() {
    // Check the length of the redis keys. If 0, re-initialize the cache
    let redisCount =
      await this.calStaffRedisService.getKeyCount('calendar-staff');
    if (redisCount === 0) {
      await this.initializeCache();
    }
    // If still 0 (as in no events have any staff assigned to them), just return
    redisCount = await this.calStaffRedisService.getKeyCount('calendar-staff');
    if (redisCount === 0) {
      return;
    }
    const calendarStaff =
      await this.calStaffRedisService.getCalendarStaff('calendar-staff');
    // Perform the auto-checkout logic using the data from Redis
    console.log('calendarStaff' + JSON.stringify(calendarStaff));
  }
}
