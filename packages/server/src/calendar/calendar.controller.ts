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
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CalendarModel } from './calendar.entity';
import { Calendar, ERROR_MESSAGES } from '@koh/common';
import { CourseModel } from 'course/course.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';

@Controller('calendar')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class CalendarController {
  @Post()
  async addEvent(@Body() body: Calendar) {
    const course = await CourseModel.findOne(body.cid);
    if (course === null || course === undefined) {
      console.error(
        ERROR_MESSAGES.courseController.courseNotFound +
          'Course ID: ' +
          body.cid,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      const event = await CalendarModel.create({
        title: body.title,
        start: body.start,
        end: body.end,
        course: course,
        allDay: body.allDay || null,
        daysOfWeek: body.daysOfWeek || null,
      }).save();
      return event;
    } catch (err) {
      console.error(err);
      throw new HttpException(
        'Calendar create error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':cid')
  async getAllEvents(@Param('cid') cid: number): Promise<CalendarModel[]> {
    const events = await CalendarModel.find({
      where: {
        course: cid,
      },
    });
    if (events === null || events === undefined) {
      console.error(ERROR_MESSAGES.courseController.courseNotFound + 'events ');
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    return events;
  }

  @Delete(':id/delete')
  async deleteCalendarEvent(
    @Param('id') eventId: number,
  ): Promise<CalendarModel> {
    const event = await CalendarModel.findOne(eventId);
    if (!event) {
      throw new HttpException('Event not found', HttpStatus.NOT_FOUND);
    }
    return event.remove();
  }
}
