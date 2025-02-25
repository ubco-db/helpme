import {
  UserFactory,
  CourseFactory,
  UserCourseFactory,
  calendarFactory,
  OrganizationFactory,
  OrganizationUserFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { CalendarModel } from '../src/calendar/calendar.entity';
import { CalendarModule } from '../src/calendar/calendar.module';
import {
  calendarEventLocationType,
  CronJob,
  ERROR_MESSAGES,
  OrganizationRole,
  Role,
} from '@koh/common';
import { CalendarStaffModel } from '../src/calendar/calendar-staff.entity';
import { OrganizationModule } from '../src/organization/organization.module';
import { CourseModel } from 'course/course.entity';
import { UserModel } from 'profile/user.entity';
import { OrganizationModel } from 'organization/organization.entity';

describe('Calendar Integration', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    CalendarModule,
    undefined,
    [OrganizationModule],
  );

  let ta1: UserModel;
  let ta2: UserModel;
  let prof: UserModel;
  let course: CourseModel;
  let org: OrganizationModel;
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const todayAt7 = new Date(now);
  todayAt7.setHours(7, 0, 0, 0);
  const todayAt8 = new Date(now);
  todayAt8.setHours(8, 0, 0, 0);
  const todayAt9 = new Date(now);
  todayAt9.setHours(9, 0, 0, 0);
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    // initialize course, task, and user factories
    ta1 = await UserFactory.create();
    ta2 = await UserFactory.create();
    prof = await UserFactory.create();
    course = await CourseFactory.create();
    await UserCourseFactory.create({
      user: ta1,
      course,
      role: Role.TA,
    });
    await UserCourseFactory.create({
      user: ta2,
      course,
      role: Role.TA,
    });
    await UserCourseFactory.create({
      user: prof,
      course,
      role: Role.PROFESSOR,
    });
    org = await OrganizationFactory.create();
    await OrganizationUserFactory.create({
      organization: org,
      organizationUser: prof,
      role: OrganizationRole.ADMIN,
    });
  });
  afterEach(async () => {
    // delete all calendar staff
    await CalendarStaffModel.delete({});
    // delete all calendar events
    await CalendarModel.delete({});
  });

  describe('POST /calendar/:cid', () => {
    it('adds a new calendar event by TA should work', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [],
      };

      const res = await supertest({ userId: user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(201);

      const savedEvent = await CalendarModel.findOne(res.body.id);
      expect(savedEvent).toBeTruthy();
    });
    it('allows the user to pass in staffIds, creating calendar_staff entries', async () => {
      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.id, ta2.id, prof.id],
      };

      const res = await supertest({ userId: prof.id })
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
        ta1.id,
        ta2.id,
        prof.id,
      ]);
    });
    it('should return 403 if a student tries to create an event', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });

      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
      };

      await supertest({ userId: user.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(403);

      const savedEvent = await CalendarModel.findOne({ title: 'Test Event' });
      expect(savedEvent).toBeUndefined();
    });
    it('should return 404 if the staffId does not exist', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
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
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.TA,
      });

      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
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
    it('should create a 1-time cron job for non-recurring events', async () => {
      const eventData = {
        title: 'Test Event',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.id, ta2.id, prof.id],
      };
      await supertest({ userId: prof.id })
        .post(`/calendar/${course.id}`)
        .send(eventData)
        .expect(201);

      // go through the jobs, filter and find all the auto-checkout jobs
      const jobsAfterRes = await supertest({ userId: prof.id }).get(
        `/organization/${org.id}/cronjobs`,
      );
      const jobsAfter = jobsAfterRes.body;
      const autoCheckoutJobsAfter: CronJob[] = jobsAfter.filter(
        (job: CronJob) => job.id.includes('auto-checkout'),
      );
      expect(autoCheckoutJobsAfter).toHaveLength(3);
      for (const job of autoCheckoutJobsAfter) {
        expect(new Date(job.cronTime)).toEqual(oneHourFromNow);
      }
    });
  });

  describe('PATCH /calendar/:calId/:cid', () => {
    it('does not allow non-logged in users to update an event', async () => {
      const event = await calendarFactory.create();

      await supertest().patch(`/calendar/${event.id}/${course.id}`).expect(401);
    });
    it('does not allow students to update an event', async () => {
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
        .expect(404);
    });
    it('updates an existing calendar event', async () => {
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
        staffIds: [],
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
      const event = await calendarFactory.create({
        course,
        start: now,
        end: oneHourFromNow,
      });

      await CalendarStaffModel.create({
        user: ta1,
        calendar: event,
        userId: ta1.id,
        calendarId: event.id,
      }).save();
      await CalendarStaffModel.create({
        user: ta2,
        calendar: event,
        userId: ta2.id,
        calendarId: event.id,
      }).save();

      const updateData = {
        title: 'Updated Event',
        locationType: calendarEventLocationType.inPerson,
        locationInPerson: 'Room 101',
        staffIds: [ta2.id, prof.id],
        start: now,
        end: oneHourFromNow,
      };

      const res = await supertest({ userId: prof.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(200);

      const updatedEvent = await CalendarModel.findOne(event.id, {
        relations: ['staff'],
      });
      expect(updatedEvent.staff).toHaveLength(2);
      expect(updatedEvent.staff.map((s) => s.userId)).toEqual([
        ta2.id,
        prof.id,
      ]);
    });
    it('does not allow the endpoint to be called with an invalid date and staff list', async () => {
      const event = await calendarFactory.create({
        course,
      });

      await CalendarStaffModel.create({
        user: ta1,
        calendar: event,
        userId: ta1.id,
        calendarId: event.id,
      }).save();
      await CalendarStaffModel.create({
        user: ta2,
        calendar: event,
        userId: ta2.id,
        calendarId: event.id,
      }).save();

      const updateData = {
        title: 'Updated Event',
        locationType: calendarEventLocationType.inPerson,
        locationInPerson: 'Room 101',
        staffIds: [ta2.id, prof.id],
        daysOfWeek: [1, 2, 3],
      };

      const res = await supertest({ userId: prof.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(400);
      expect(res.body.message).toBe(
        ERROR_MESSAGES.calendarEvent.invalidRecurringEvent,
      );

      const notUpdatedEvent = await CalendarModel.findOne(event.id, {
        relations: ['staff'],
      });
      expect(notUpdatedEvent.staff).toHaveLength(2);
      expect(notUpdatedEvent.staff.map((s) => s.userId)).toEqual([
        ta1.id,
        ta2.id,
      ]);
    });
    it('updates the auto-checkout cron jobs with new startDates and endDates', async () => {
      // create an event using the endpoint, that way the cron jobs are made
      const eventData = {
        title: 'Test Event',
        start: todayAt7,
        end: todayAt8,
        daysOfWeek: [1, 2, 3],
        startDate: todayAt7,
        endDate: oneMonthFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.id, ta2.id, prof.id],
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
        expect(job.cronTime).toEqual('0 8 * * 1,2,3');
      }

      const updateData = {
        ...eventData,
        end: todayAt9,
        daysOfWeek: [1, 2, 3, 4],
        staffIds: [ta1.id, prof.id],
      };

      await supertest({ userId: prof.id })
        .patch(`/calendar/${event.id}/${course.id}`)
        .send(updateData)
        .expect(200);

      const updatedEvent = await CalendarModel.findOne(event.id, {
        relations: ['staff'],
      });
      expect(updatedEvent.end).toEqual(todayAt9);
      expect(updatedEvent.daysOfWeek).toEqual(['1', '2', '3', '4']);
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
        expect(job.cronTime).toEqual('0 9 * * 1,2,3,4');
      }
    });
  });

  describe('GET /calendar/:cid', () => {
    it('gets all events for a course by a student should work', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      await calendarFactory.create({
        title: 'Event 1',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/j/example',
        course: course,
      });
      await CalendarModel.create({
        title: 'Event 2',
        start: now,
        end: oneHourFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/j/example',
        course: course,
      }).save();

      const res = await supertest({ userId: user.id })
        .get(`/calendar/${course.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[1]).toHaveProperty('title', 'Event 1');
      expect(res.body[0]).toHaveProperty('title', 'Event 2');
    });
  });

  describe('DELETE /calendar/:eventId/:cid/delete', () => {
    it('deletes a calendar event', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.PROFESSOR,
      });
      const event = await CalendarModel.create({
        title: 'Event to Delete',
        start: now,
        end: oneHourFromNow,
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

    it('should return 403 if a student tries to delete an event', async () => {
      const user = await UserFactory.create();
      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });
      const event = await CalendarModel.create();
      await supertest({ userId: user.id })
        .delete(`/calendar/${event.id}/${course.id}/delete`)
        .expect(403);
    });
    it('should delete an auto-checkout job for each staff member', async () => {
      // create an event using the endpoint, that way the cron jobs are made
      const eventData = {
        title: 'Test Event',
        start: todayAt7,
        end: todayAt8,
        daysOfWeek: [1, 2, 3],
        startDate: todayAt7,
        endDate: oneMonthFromNow,
        locationType: calendarEventLocationType.online,
        locationOnline: 'https://zoom.us/test',
        allDay: false,
        staffIds: [ta1.id, ta2.id, prof.id],
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
        expect(job.cronTime).toEqual('0 8 * * 1,2,3');
      }

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await supertest({ userId: prof.id })
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
        `Deleted cron job with name auto-checkout-${ta1.id}-${event.id}`,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleted cron job with name auto-checkout-${ta2.id}-${event.id}`,
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        `Deleted cron job with name auto-checkout-${prof.id}-${event.id}`,
      );
      consoleSpy.mockRestore();

      // go through the jobs, filter and find all the auto-checkout jobs
      const jobsAfterRes = await supertest({ userId: prof.id }).get(
        `/organization/${org.id}/cronjobs`,
      );
      const jobsAfter = jobsAfterRes.body;
      const autoCheckoutJobsAfter: CronJob[] = jobsAfter.filter(
        (job: CronJob) => job.id.includes('auto-checkout'),
      );
      expect(autoCheckoutJobsAfter).toHaveLength(0);
    });
  });
});
