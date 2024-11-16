import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  calendarFactory,
  TACourseFactory,
  ProfessorCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { CalendarModel } from '../src/calendar/calendar.entity';
import { CalendarModule } from '../src/calendar/calendar.module';
import {
  calendarEventLocationType,
  CronJob,
  OrganizationRole,
  Role,
} from '@koh/common';
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
    it('does not allow non-logged in users to update an event', async () => {
      const course = await CourseFactory.create();
      const event = await calendarFactory.create();

      await supertest().patch(`/calendar/${event.id}/${course.id}`).expect(401);
    });
    it('does not allow students to update an event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });

      const event = await calendarFactory.create();

      await supertest({ userId: user.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .expect(403);
    });
    it('does not allow professors from other courses to update an event', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });

      const event = await calendarFactory.create({ course });

      const otherCourse = await CourseFactory.create();
      const otherUser = await UserFactory.create();
      await UserCourseFactory.create({
        user: otherUser,
        course: otherCourse,
        role: Role.PROFESSOR,
      });

      await supertest({ userId: otherUser.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .expect(403);
    });
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
    it('updates the staff for an event', async () => {
      const course = await CourseFactory.create();
      const ta1 = await TACourseFactory.create({ course });
      const ta2 = await TACourseFactory.create({ course });
      const prof = await ProfessorCourseFactory.create({ course });
      const event = await calendarFactory.create({
        course,
      });

      await CalendarStaffModel.create({
        user: ta1.user,
        calendar: event,
        userId: ta1.user.id,
        calendarId: event.id,
      }).save();
      await CalendarStaffModel.create({
        user: ta2.user,
        calendar: event,
        userId: ta2.user.id,
        calendarId: event.id,
      }).save();

      const updateData = {
        staffIds: [ta2.user.id, prof.user.id],
      };

      const res = await supertest({ userId: prof.user.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(200);

      const updatedEvent = await CalendarModel.findOne(event.id);
      expect(updatedEvent.staff).toHaveLength(2);
      expect(updatedEvent.staff.map((s) => s.userId)).toEqual([
        ta2.user.id,
        prof.user.id,
      ]);
    });
    it('updates the auto-checkout cron jobs with new startDates and endDates', async () => {
      const org = await OrganizationFactory.create();
      const prof = await UserFactory.create();
      await OrganizationUserFactory.create({
        organization: org,
        organizationUser: prof,
        role: OrganizationRole.ADMIN,
      });
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: prof,
        course,
        role: Role.PROFESSOR,
      });
      const ta1 = await TACourseFactory.create({ course });
      const ta2 = await TACourseFactory.create({ course });
      // create an event using the endpoint, that way the cron jobs are made
      const eventData = {
        title: 'Test Event',
        start: new Date('2023-08-26T10:00:00'),
        end: new Date('2023-08-26T11:00:00'),
        daysOfWeek: [1, 2, 3],
        startDate: new Date('2023-08-24T10:00:00'),
        endDate: new Date('2023-09-26T11:00:00'),
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.user.id, ta2.user.id, prof.id],
      };
      const eventRes = await supertest({ userId: prof.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(201);
      const event: CalendarModel = eventRes.body;

      // go through the jobs, filter and find all the auto-checkout jobs
      const jobsBeforeRes = await supertest({ userId: prof.id }).get(
        `/organization/${org.id}/cronjobs`,
      );
      const jobsBefore = jobsBeforeRes.body;
      const autoCheckoutJobsBefore: CronJob[] = jobsBefore.filter(
        (job: CronJob) => job.id.includes('auto-checkout'),
      );
      expect(autoCheckoutJobsBefore).toHaveLength(3);
      for (const job of autoCheckoutJobsBefore) {
        expect(job.cronTime).toEqual('0 11 * * 1,2,3');
      }

      const updateData = {
        ...eventData,
        end: new Date('2023-08-26T12:00:00'),
        daysOfWeek: [1, 2, 3, 4],
        staffIds: [ta1.user.id, prof.id],
      };

      await supertest({ userId: prof.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(200);

      const updatedEvent = await CalendarModel.findOne(event.id);
      expect(updatedEvent.end).toEqual(new Date('2023-08-26T12:00:00'));
      expect(updatedEvent.daysOfWeek).toEqual([1, 2, 3, 4]);
      expect(updatedEvent.staff).toHaveLength(2);

      // go through the jobs, filter and find all the auto-checkout jobs
      const jobsAfterRes = await supertest({ userId: prof.id }).get(
        `/organization/${org.id}/cronjobs`,
      );
      const jobsAfter = jobsAfterRes.body;
      const autoCheckoutJobsAfter: CronJob[] = jobsAfter.filter(
        (job: CronJob) => job.id.includes('auto-checkout'),
      );
      expect(autoCheckoutJobsAfter).toHaveLength(2);
      for (const job of autoCheckoutJobsAfter) {
        expect(job.cronTime).toEqual('0 12 * * 1,2,3,4');
      }
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
    it('should delete an auto-checkout job for each staff member', async () => {
      const course = await CourseFactory.create();
      const ta1 = await TACourseFactory.create({ course });
      const ta2 = await TACourseFactory.create({ course });
      const prof = await ProfessorCourseFactory.create({ course });

      const event = await calendarFactory.create({
        course: course,
        staff: [],
      });

      await CalendarStaffModel.create({
        user: ta1.user,
        calendar: event,
        userId: ta1.user.id,
        calendarId: event.id,
      }).save();

      await CalendarStaffModel.create({
        user: ta2.user,
        calendar: event,
        userId: ta2.user.id,
        calendarId: event.id,
      }).save();

      await CalendarStaffModel.create({
        user: prof.user,
        calendar: event,
        userId: prof.user.id,
        calendarId: event.id,
      }).save();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await supertest({ userId: prof.user.id })
        .delete(`/calendar/${event.id}/${course.id}/delete`)
        .expect(200);

      const deletedEvent = await CalendarModel.findOne(event.id);
      expect(deletedEvent).toBeUndefined();

      const calendarStaff = await CalendarStaffModel.find({
        calendarId: event.id,
      });
      expect(calendarStaff).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleted cron job with name auto-checkout-${ta1.user.id}-${event.id}`,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleted cron job with name auto-checkout-${ta2.user.id}-${event.id}`,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleted cron job with name auto-checkout-${prof.user.id}-${event.id}`,
      );

      consoleSpy.mockRestore();
    });
  });
});
