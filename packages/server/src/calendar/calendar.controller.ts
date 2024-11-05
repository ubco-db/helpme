import { CalendarService } from './calendar.service';
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Body,
  HttpException,
  HttpStatus,
  Delete,
  Patch,
  Query,
  ParseIntPipe,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CalendarModel } from './calendar.entity';
import { Calendar, ERROR_MESSAGES, OrganizationRole, Role } from '@koh/common';
import { CourseModel } from 'course/course.entity';
import { Roles } from 'decorators/roles.decorator';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { getManager } from 'typeorm';
import { OrganizationRolesGuard } from 'guards/organization-roles.guard';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}
  @Post(':cid')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async addEvent(
    @Body() body: Calendar,
    @Param('cid', ParseIntPipe) cid: number,
  ): Promise<CalendarModel> {
    const course = await CourseModel.findOne(cid);
    if (!course) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      body.daysOfWeek &&
      body.daysOfWeek.length > 0 &&
      (!body.startDate || !body.endDate)
    ) {
      throw new HttpException(
        'Recurring events must have a start and end date',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const entityManager = getManager();
      let event: null | CalendarModel = null;
      await entityManager.transaction(async (transactionalEntityManager) => {
        event = await transactionalEntityManager.save(CalendarModel, {
          title: body.title,
          start: body.start,
          end: body.end || null,
          startDate: body.startDate || null,
          endDate: body.endDate || null,
          locationType: body.locationType,
          locationInPerson: body.locationInPerson || null,
          locationOnline: body.locationOnline || null,
          allDay: body.allDay || false,
          daysOfWeek: body.daysOfWeek || [],
          course: course,
          color: body.color || '#3788d8',
        });
        if (body.staffIds) {
          for (const staffId of body.staffIds) {
            await this.calendarService.createCalendarStaff(
              staffId,
              event,
              transactionalEntityManager,
            );
            await this.calendarService.createAutoCheckoutCronJob(
              staffId,
              event.id,
              event.startDate,
              event.endDate,
              event.end,
              event.daysOfWeek,
              cid,
            );
          }
        }
      });
      return event;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      } else {
        console.error(err);
        throw new HttpException(
          'Calendar create error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Patch(':calId/:cid')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async updateEvent(
    @Param('calId', ParseIntPipe) calId: string,
    @Body() body: Partial<Calendar>,
  ): Promise<CalendarModel> {
    const event = await CalendarModel.findOne(calId);
    if (!event) {
      console.error('Event not found with calID: ' + calId);
      throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    }
    if (
      body.daysOfWeek &&
      body.daysOfWeek.length > 0 &&
      (!body.startDate || !body.endDate)
    ) {
      throw new HttpException(
        'Recurring events must have a start and end date',
        HttpStatus.BAD_REQUEST,
      );
    }
    Object.assign(event, body);
    try {
      await event.save();
      return event;
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Calendar update error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':cid')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async getAllEvents(
    @Param('cid', ParseIntPipe) cid: number,
  ): Promise<CalendarModel[]> {
    const events = await CalendarModel.find({ where: { course: cid } });
    return events || [];
  }

  @Get(':cid/:date')
  async getEventsForDay(
    @Param('cid') cid: number,
    @Param('date') date: string,
    @Query('timezone') timezone: string,
  ): Promise<CalendarModel[]> {
    // Parse the date string into a Date object
    const targetDate = new Date(date);

    // Get the start and end of the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    // Determine the day of week index from the target date
    const dayOfWeek = targetDate.getDay().toString();
    // Retrieve all events for the given course
    const events = await CalendarModel.find({
      where: { course: cid },
    });
    // Filter to get events occurring on the target date
    const filteredEvents = events.filter((event) => {
      if (!event.daysOfWeek) {
        // For one-time events, check if they occur on the target date
        return (
          new Date(event.start) >= startOfDay && new Date(event.end) <= endOfDay
        );
      } else {
        // For recurring events, check if the target day is a match and within the event's date range
        return (
          event.daysOfWeek.includes(dayOfWeek) &&
          new Date(event.start) <= targetDate &&
          (!event.endDate || new Date(event.endDate) >= targetDate)
        );
      }
    });
    return filteredEvents;
  }

  @Delete(':eventId/:cid/delete')
  @UseGuards(CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async deleteCalendarEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<CalendarModel> {
    const event = await CalendarModel.findOne(eventId, {
      relations: ['staff'],
    });
    if (!event) {
      console.error('Event not found');
      throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    }
    try {
      // TODO: put this in a transaction
      const removedEvent = await event.remove();
      // for each staff member associated with the event, remove the association
      for (const staff of removedEvent.staff) {
        await this.calendarService.deleteCalendarStaff(
          staff.userId,
          staff.calendarId,
          true,
        );
      }
      return removedEvent;
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Calendar delete error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('reset_cron_jobs/:oid')
  @UseGuards(OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async resetCronJobs(@Param('oid', ParseIntPipe) oid: number) {
    console.log('Resetting cron jobs');
    await this.calendarService.resetAutoCheckoutJobs();
  }
}
