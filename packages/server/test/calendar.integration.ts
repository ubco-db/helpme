import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  calendarFactory,
  TACourseFactory,
  ProfessorCourseFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { CalendarModel } from '../src/calendar/calendar.entity';
import { CalendarModule } from '../src/calendar/calendar.module';
import { calendarEventLocationType, Role } from '@koh/common';
import { CalendarStaffModel } from 'calendar/calendar-staff.entity';

describe('Calendar Integration', () => {
  const supertest = setupIntegrationTest(CalendarModule);

  describe('POST /calendar/:cid', () => {
    it('adds a new calendar event by TA should work', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
      };

      const res = await supertest({ userId: user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(201);

      const savedEvent = await CalendarModel.findOne(res.body.id);
      expect(savedEvent).toBeTruthy();
    });
    it('allows the user to pass in staffIds, creating calendar_staff entries', async () => {
      const course = await CourseFactory.create();
      const ta1 = await TACourseFactory.create({ course });
      const ta2 = await TACourseFactory.create({ course });
      const prof = await ProfessorCourseFactory.create({ course });
      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.user.id, ta2.user.id, prof.user.id],
      };

      const res = await supertest({ userId: prof.user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(201);

      const savedEvent = await CalendarModel.findOne(res.body.id);
      expect(savedEvent).toBeTruthy();

      const calendarStaff = await CalendarStaffModel.find({
        calendarId: savedEvent.id,
      });
      expect(calendarStaff).toHaveLength(3);
      expect(calendarStaff.map((cs) => cs.userId)).toEqual([
        ta1.user.id,
        ta2.user.id,
        prof.user.id,
      ]);
    });
    it('should return bad request if a student tries to create an event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });

      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
      };

      await supertest({ userId: user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(400);

      const savedEvent = await CalendarModel.findOne({ title: 'Test Event' });
      expect(savedEvent).toBeUndefined();
    });
    it('should return 404 if the staffId does not exist', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [999],
      };

      await supertest({ userId: user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(404);

      const savedEvent = await CalendarModel.findOne({ title: 'Test Event' });
      expect(savedEvent).toBeUndefined();
    });
    it('should return 404 if the course does not exist', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
      };

      await supertest({ userId: user.id })
        .post(`/calendar/999`)
        .send(eventData)
        .expect(404);

      const savedEvent = await CalendarModel.findOne({ title: 'Test Event' });
      expect(savedEvent).toBeUndefined();
    });
  });

  describe('PATCH /calendar/:calId/:cid', () => {
    it('updates an existing calendar event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const event = await calendarFactory.create();

      const updateData = {
        title: 'Updated Event',
        locationType: calendarEventLocationType.inPerson,
        locationInPerson: 'Room 101',
      };

      const res = await supertest({ userId: user.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(200);

      expect(res.body).toEqual(expect.objectContaining(updateData));

      const updatedEvent = await CalendarModel.findOne(event.id);
      expect(updatedEvent.title).toBe('Updated Event');
      expect(updatedEvent.locationType).toBe('in-person');
      expect(updatedEvent.locationInPerson).toBe('Room 101');
    });
  });

  describe('GET /calendar/:cid', () => {
    it('gets all events for a course by a student should work', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      //     export const calendarFactory = new Factory(CalendarModel)
      // .attr('title', 'Zoom Meeting')
      // .attr('start', new Date())
      // .attr('end', new Date())
      // .attr('startDate', null)
      // .attr('endDate', null)
      // .attr('locationType', calendarEventLocationType.online)
      // .attr('locationInPerson', null)
      // .attr('locationOnline', 'https://zoom.us/j/example')
      // .attr('allDay', false)
      // .attr('daysOfWeek', [])
      // .assocOne('course', CourseFactory);
      await calendarFactory.create({
        title: 'Event 1',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/j/example',
        course: course,
      });
      await CalendarModel.create({
        title: 'Event 2',
        start: new Date('2023-08-27T10:00:00'),
        end: new Date('2023-08-27T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/j/example',
        course: course,
      }).save();

      const res = await supertest({ userId: user.id })
        .get(`/calendar/${course.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('title', 'Event 1');
      expect(res.body[1]).toHaveProperty('title', 'Event 2');
    });
  });

  describe('DELETE /calendar/:eventId/:cid/delete', () => {
    it('deletes a calendar event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });
      const event = await CalendarModel.create({
        title: 'Event to Delete',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/j/example',
        course: course,
      }).save();

      await supertest({ userId: user.id })
        .delete(`/calendar/${event.id}/${course.id}/delete`)
        .expect(200);

      const deletedEvent = await CalendarModel.findOne(event.id);
      expect(deletedEvent).toBeUndefined();
    });

    it('should return bad request if a student tries to delete an event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      const event = await CalendarModel.create();
      await supertest({ userId: user.id })
        .delete(`/calendar/${event.id}/${course.id}/delete`)
        .expect(400);
    });
  });
});
