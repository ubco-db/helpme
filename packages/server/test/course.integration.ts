import {
  ERROR_MESSAGES,
  QuestionStatusKeys,
  Role,
  TACheckinTimesResponse,
} from '@koh/common';
import { CourseModel } from '../src/course/course.entity';
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { EventModel, EventType } from 'profile/event-model.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { CourseModule } from '../src/course/course.module';
import { QueueModel } from '../src/queue/queue.entity';
import {
  CourseFactory,
  CourseSectionFactory,
  EventFactory,
  OrganizationCourseFactory,
  OrganizationFactory,
  OrganizationUserFactory,
  QueueFactory,
  SemesterFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserCourseFactory,
  UserFactory,
  CourseSettingsFactory,
  QuestionFactory,
} from './util/factories';
import { setupIntegrationTest } from './util/testUtils';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { QuestionTypeModel } from 'questionType/question-type.entity';

describe('Course Integration', () => {
  const supertest = setupIntegrationTest(CourseModule);

  describe('GET /courses/:id', () => {
    it('gets office hours no queues, since no queue is happening right now', async () => {
      const course = await CourseFactory.create({
        timezone: 'America/New_York',
      });
      await QueueFactory.create();

      await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      // will not load b/c office hours aren't happening right now
      // (unless you go back in time and run these tests )
      const response = await supertest({ userId: 1 })
        .get(`/courses/${course.id}`)
        .expect(200);
      expect(response.body).toMatchSnapshot();
    });

    it('gets queues that are not disabled and staffed (student)', async () => {
      const course = await CourseFactory.create();
      const ucf = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const taf = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      await QueueFactory.create({
        isDisabled: true,
        room: 'room 1',
        course: course,
      });

      await QueueFactory.create({
        isDisabled: false,
        room: 'room 2',
        course: course,
      });
      await QueueFactory.create({
        isDisabled: false,
        room: 'room 3',
        course: course,
        staffList: [taf.user],
      });

      const response = await supertest({ userId: ucf.userId })
        .get(`/courses/${course.id}`)
        .expect(200);
      // expect(response.body.queues.length).toBe(1);
      expect(response.body.queues.length).toBe(2);
      // expect(response.body.queues[0].room).toBe('room 3');
    });

    it('gets queues that are not disabled (TA)', async () => {
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const taf = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      await QueueFactory.create({
        isDisabled: true,
        room: 'room 1',
        course: course,
      });

      await QueueFactory.create({
        isDisabled: false,
        room: 'room 2',
        course: course,
      });
      await QueueFactory.create({
        isDisabled: false,
        room: 'room 3',
        course: course,
        staffList: [taf.user],
      });

      await QueueFactory.create({
        isDisabled: false,
        isProfessorQueue: true,
        room: 'room 4',
        course: course,
        staffList: [taf.user],
      });

      const response = await supertest({ userId: taf.userId })
        .get(`/courses/${course.id}`)
        .expect(200);
      // date agnostic snapshots
      expect(response.body.queues.length).toBe(3);
      response.body.queues.map((q) => expect(q).toMatchSnapshot({}));

      response.body.queues.map((q) => expect(q.isDisabled).toBeFalsy());
    });

    it('gets all queues that are not disabled (prof)', async () => {
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const taf = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const proff = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
        role: Role.PROFESSOR,
      });
      await QueueFactory.create({
        isDisabled: true,
        room: 'room 1',
        course: course,
      });

      await QueueFactory.create({
        isDisabled: false,
        room: 'room 2',
        course: course,
      });
      await QueueFactory.create({
        isDisabled: false,
        room: 'room 3',
        course: course,
        staffList: [taf.user],
      });

      await QueueFactory.create({
        isDisabled: false,
        isProfessorQueue: true,
        room: 'room 4',
        course: course,
        staffList: [taf.user],
      });
      await QueueFactory.create({
        isDisabled: true,
        isProfessorQueue: true,
        room: 'room 5',
        course: course,
        staffList: [taf.user],
      });

      const response = await supertest({ userId: proff.userId })
        .get(`/courses/${course.id}`)
        .expect(200);

      // date agnostic snapshots
      response.body.queues.map((q) => expect(q).toMatchSnapshot({}));

      response.body.queues.map((q) => expect(q.isDisabled).toBeFalsy());
    });

    it('cant get office hours if not a member of the course', async () => {
      const course = await CourseFactory.create();

      await QueueFactory.create({
        room: "Matthias's Office",
        course: course,
      });

      await supertest({ userId: 1 }).get(`/courses/${course.id}`).expect(401);
    });

    it('ensures isOpen is defined for all queues(dynamic gen)', async () => {
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const taf = await TACourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      const proff = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
        role: Role.PROFESSOR,
      });
      await QueueFactory.create({
        isDisabled: true,
        room: 'room 1',
        course: course,
      });

      await QueueFactory.create({
        isDisabled: false,
        room: 'room 2',
        course: course,
      });
      await QueueFactory.create({
        isDisabled: false,
        room: 'room 3',
        course: course,
        staffList: [taf.user],
      });

      await QueueFactory.create({
        isDisabled: false,
        isProfessorQueue: true,
        room: 'room 4',
        course: course,
        staffList: [taf.user],
      });
      await QueueFactory.create({
        isDisabled: true,
        isProfessorQueue: true,
        room: 'room 5',
        course: course,
        staffList: [taf.user],
      });

      const response = await supertest({ userId: proff.userId })
        .get(`/courses/${course.id}`)
        .expect(200);
      response.body.queues.map((q) => {
        expect(q.isOpen).toBeDefined();
      });
    });
  });

  describe('GET /courses/limited/:id/:code', () => {
    it('should return course details for valid id and code', async () => {
      const course = await CourseFactory.create();

      const organization = await OrganizationFactory.create();

      await OrganizationCourseFactory.create({
        courseId: course.id,
        organizationId: organization.id,
      });

      const response = await supertest()
        .get(`/courses/limited/${course.id}/${course.courseInviteCode}`)
        .expect(200);

      expect(response.body.id).toBe(course.id);
      expect(response.body.name).toBe(course.name);
      expect(response.body.courseInviteCode).toBe(course.courseInviteCode);
    });

    it('should return 404 for invalid id or code', async () => {
      const response = await supertest({ userId: 1 })
        .get('/courses/limited/1/wrongcode')
        .expect(404);

      expect(response.body.message).toBe(
        ERROR_MESSAGES.courseController.courseNotFound,
      );
    });
  });

  //TODO: make a DSL for testing auth points using Hack your own Language
  describe('POST /courses/:id/ta_location/:room', () => {
    it('checks a TA into an existing queue', async () => {
      const queue = await QueueFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      const response = await supertest({ userId: ta.id })
        .post(`/courses/${queue.course.id}/ta_location/${queue.room}`)
        .expect(201);

      expect(response.body).toMatchSnapshot();

      const events = await EventModel.find();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe(EventType.TA_CHECKED_IN);
      expect(events[0].queueId).toBe(queue.id);
    });

    it("Doesn't allow student to check in", async () => {
      const queue = await QueueFactory.create();
      const student = await UserFactory.create();
      await StudentCourseFactory.create({
        course: queue.course,
        user: student,
      });

      await supertest({ userId: student.id })
        .post(`/courses/${queue.course.id}/ta_location/${queue.room}`)
        .expect(403);

      const events = await EventModel.find();
      expect(events.length).toBe(0);
    });

    it('TA cannot create a new queue while checking in', async () => {
      const ta = await UserFactory.create();
      const tcf = await TACourseFactory.create({
        course: await CourseFactory.create(),
        user: ta,
      });
      await supertest({ userId: ta.id })
        .post(`/courses/${tcf.courseId}/ta_location/WVH 404`)
        .expect(404);
    });

    it('Professors cannot create a new queue while checking in', async () => {
      const professor = await UserFactory.create();
      const pcf = await UserCourseFactory.create({
        course: await CourseFactory.create(),
        user: professor,
        role: Role.PROFESSOR,
      });
      await supertest({ userId: professor.id })
        .post(`/courses/${pcf.courseId}/ta_location/The Alamo`)
        .expect(404);
    });

    it("Doesn't allow users to check into multiple queues", async () => {
      const queue1 = await QueueFactory.create();
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue1.course,
        user: ta,
      });
      const queue2 = await QueueFactory.create({
        course: queue1.course,
      });

      await supertest({ userId: ta.id })
        .post(`/courses/${queue1.courseId}/ta_location/${queue1.room}`)
        .expect(201);

      let events = await EventModel.count();
      expect(events).toBe(1);

      const response2 = await supertest({ userId: ta.id })
        .post(`/courses/${queue2.courseId}/ta_location/${queue2.room}`)
        .expect(401);
      expect(response2.body.message).toBe(
        ERROR_MESSAGES.courseController.checkIn.cannotCheckIntoMultipleQueues,
      );
      events = await EventModel.count();
      expect(events).toBe(1);
    });

    it('doesnt allow people to join disabled queues', async () => {
      const queue1 = await QueueFactory.create({
        isDisabled: true,
      });
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue1.course,
        user: ta,
      });
      await supertest({ userId: ta.id })
        .post(`/courses/${queue1.courseId}/ta_location/${queue1.room}`)
        .expect(404);
    });

    it('correctly checks-in to the right queue (name-collision)', async () => {
      const queue1 = await QueueFactory.create({
        isDisabled: true,
      });
      await QueueFactory.create({
        course: queue1.course,
        isDisabled: false,
      });
      const ta = await UserFactory.create();
      await TACourseFactory.create({
        course: queue1.course,
        user: ta,
      });

      // should log us into the second one.
      const q = await supertest({ userId: ta.id })
        .post(`/courses/${queue1.courseId}/ta_location/${queue1.room}`)
        .expect(201);

      expect(q.body.isDisabled).toBeFalsy();
    });
  });

  describe('DELETE /courses/:id/ta_location/:room', () => {
    it('tests TA is checked out from queue if exists', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({
        room: 'The Alamo',
        staffList: [ta],
      });
      const tcf = await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      expect(
        (await QueueModel.findOne({}, { relations: ['staffList'] })).staffList
          .length,
      ).toEqual(1);

      await supertest({ userId: ta.id })
        .delete(`/courses/${tcf.courseId}/ta_location/The Alamo`)
        .expect(200);

      expect(
        await QueueModel.findOne({}, { relations: ['staffList'] }),
      ).toMatchObject({
        staffList: [],
      });

      const events = await EventModel.find();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe(EventType.TA_CHECKED_OUT);
      expect(events[0].queueId).toBe(queue.id);
    });

    it('tests student cant checkout from queue', async () => {
      const student = await UserFactory.create();
      const queue = await QueueFactory.create({
        room: 'The Alamo',
      });
      const scf = await StudentCourseFactory.create({
        course: queue.course,
        user: student,
      });

      await supertest({ userId: student.id })
        .delete(`/courses/${scf.courseId}/ta_location/The Alamo`)
        .expect(403);
    });

    it('tests nothing happens if ta not in queue', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({ room: 'The Alamo' });
      const tcf = await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      await supertest({ userId: ta.id })
        .delete(`/courses/${tcf.courseId}/ta_location/The Alamo`)
        .expect(200);

      expect(
        await QueueModel.findOne({}, { relations: ['staffList'] }),
      ).toMatchObject({
        staffList: [],
      });

      const events = await EventModel.find({
        where: { userId: ta.id },
      });

      expect(events.length).toBe(0);
    });

    it('correctly checks out when two queues have same location, but one is disabled ', async () => {
      const ta = await UserFactory.create();
      const queue = await QueueFactory.create({
        room: 'room1',
        isDisabled: true,
      });
      const tcf = await TACourseFactory.create({
        course: queue.course,
        user: ta,
      });

      await QueueFactory.create({
        course: queue.course,
        room: queue.room,
        isDisabled: false,
        staffList: [ta],
      });

      await supertest({ userId: ta.id })
        .delete(`/courses/${tcf.courseId}/ta_location/${queue.room}`)
        .expect(200);
      const q3 = await QueueModel.findOne(
        {
          room: queue.room,
          isDisabled: false,
        },
        { relations: ['staffList'] },
      );

      expect(q3.staffList.length).toBe(0);
    });
  });

  describe('POST /courses/:id/create_queue/:room', () => {
    it('correctly propagates notes,profq,and name', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      const uct = await UserCourseFactory.create({
        role: Role.TA,
        course: ucp.course,
      });

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({ notes: 'example note 1', isProfessorQueue: false })
        .expect(201);

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd2`)
        .send({ notes: 'example note 7', isProfessorQueue: true })
        .expect(201);

      await supertest({ userId: uct.user.id })
        .post(`/courses/${uct.course.id}/create_queue/abcd3`)
        .send({ notes: 'ta queue', isProfessorQueue: false })
        .expect(201);

      const q1 = await QueueModel.findOne({ room: 'abcd1' });
      const q2 = await QueueModel.findOne({ room: 'abcd2' });
      const q3 = await QueueModel.findOne({ room: 'abcd3' });

      expect(q1).toBeDefined();
      expect(q2).toBeDefined();
      expect(q3).toBeDefined();

      expect(q1).toMatchSnapshot({
        id: expect.any(Number),
        courseId: expect.any(Number),
      });

      expect(q2).toMatchSnapshot({
        id: expect.any(Number),
        courseId: expect.any(Number),
      });

      expect(q3).toMatchSnapshot({
        id: expect.any(Number),
        courseId: expect.any(Number),
      });
    });

    it('prevents TAs from creating prof queues', async () => {
      const uct = await UserCourseFactory.create({
        role: Role.TA,
      });
      await supertest({ userId: uct.user.id })
        .post(`/courses/${uct.course.id}/create_queue/abcd3`)
        .send({ notes: 'ta queue', isProfessorQueue: true })
        .expect(401); // unauthorized
    });

    it('prevents people from creating pre-existing queues', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({ notes: 'example note 1', isProfessorQueue: false })
        .expect(201);
      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({ notes: 'example note 2', isProfessorQueue: false })
        .expect(400);
    });

    it('allows people to recreate recently disabled queues', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });
      const queue1 = await QueueFactory.create({
        course: ucp.course,
        isDisabled: true,
        room: `aabb`,
        notes: '',
        isProfessorQueue: false,
      });

      // recreate a disabled queue.
      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/${queue1.room}`)
        .send({
          notes: queue1.notes,
          isProfessorQueue: queue1.isProfessorQueue,
        })
        .expect(201);
    });

    it('when creating queue, it saves the queue config correctly', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      const exampleConfig = {
        tags: {
          tag1: {
            display_name: 'Tag 1',
            color_hex: '#ff0000',
          },
        },
      };

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({
          notes: 'example note 1',
          isProfessorQueue: false,
          config: exampleConfig,
        })
        .expect(201);

      const q1 = await QueueModel.findOne({ room: 'abcd1' });
      expect(q1.config).toEqual(exampleConfig);
    });

    it('does not allow an invalid queue config', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({
          notes: 'example note 1',
          isProfessorQueue: false,
          config: { key: 'value' },
        })
        .expect(400);

      const q1 = await QueueModel.findOne({ room: 'abcd1' });
      expect(q1).toEqual(undefined);
    });

    it('creates question types for each tag defined in the config', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      const exampleConfig = {
        tags: {
          tag1: {
            display_name: 'Tag 1',
            color_hex: '#ff0000',
          },
          tag2: {
            display_name: 'Tag 2',
            color_hex: '#00ff00',
          },
        },
      };

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({
          notes: 'example note 1',
          isProfessorQueue: false,
          config: exampleConfig,
        })
        .expect(201);

      const q1 = await QueueModel.findOne({ room: 'abcd1' });
      expect(q1.config).toEqual(exampleConfig);

      const questionTypes = await QuestionTypeModel.find({
        where: {
          cid: ucp.course.id,
        },
      });

      expect(questionTypes.length).toBe(2);
      expect(questionTypes[0].name).toBe('Tag 1');
      expect(questionTypes[0].color).toBe('#ff0000');
      expect(questionTypes[1].name).toBe('Tag 2');
      expect(questionTypes[1].color).toBe('#00ff00');
    });

    it('does not create question types for duplicate tags (display_name)', async () => {
      const ucp = await UserCourseFactory.create({
        role: Role.PROFESSOR,
      });

      const exampleConfig = {
        tags: {
          tag1: {
            display_name: 'Tag 1',
            color_hex: '#ff0000',
          },
          tag2: {
            display_name: 'Tag 1',
            color_hex: '#00ff00',
          },
        },
      };

      await supertest({ userId: ucp.user.id })
        .post(`/courses/${ucp.course.id}/create_queue/abcd1`)
        .send({
          notes: 'example note 1',
          isProfessorQueue: false,
          config: exampleConfig,
        })
        .expect(400);

      const q1 = await QueueModel.findOne({ room: 'abcd1' });
      expect(q1).toBeUndefined();

      const questionTypes = await QuestionTypeModel.find({
        where: {
          cid: ucp.course.id,
        },
      });

      expect(questionTypes.length).toBe(0);
    });
  });

  describe('GET /courses/:id/ta_check_in_times', () => {
    it('tests that events within date range are gotten', async () => {
      const now = new Date();
      const yesterday = new Date();
      yesterday.setUTCHours(now.getUTCHours() - 24);
      const course = await CourseFactory.create();
      const ta = await UserFactory.create();
      const professor = await UserFactory.create();

      await UserCourseFactory.create({
        user: ta,
        role: Role.TA,
        course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course,
      });

      await EventFactory.create({
        user: ta,
        course: course,
        time: yesterday,
        eventType: EventType.TA_CHECKED_IN,
      });

      const yesterdayPlusTwoHours = new Date(yesterday);
      yesterdayPlusTwoHours.setUTCHours(yesterday.getUTCHours() + 2);

      await EventFactory.create({
        user: ta,
        course: course,
        time: new Date(yesterdayPlusTwoHours),
        eventType: EventType.TA_CHECKED_OUT,
      });

      const thenThreeMoreHours = new Date(yesterdayPlusTwoHours);
      thenThreeMoreHours.setUTCHours(yesterdayPlusTwoHours.getUTCHours() + 3);

      await EventFactory.create({
        user: ta,
        course: course,
        time: thenThreeMoreHours,
        eventType: EventType.TA_CHECKED_IN,
      });

      const twelveHoursAFter = new Date(thenThreeMoreHours);
      twelveHoursAFter.setUTCHours(thenThreeMoreHours.getUTCHours() + 12);

      await EventFactory.create({
        user: ta,
        course: course,
        time: twelveHoursAFter,
        eventType: EventType.TA_CHECKED_OUT_FORCED,
      });

      const justNow = new Date(Date.now() - 1000);

      await EventFactory.create({
        user: ta,
        course: course,
        time: justNow,
        eventType: EventType.TA_CHECKED_IN,
      });

      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      const dateNow = new Date();
      const data = await supertest({ userId: professor.id })
        .get(`/courses/${course.id}/ta_check_in_times`)
        .query({
          startDate: twoDaysAgo,
          endDate: dateNow,
        })
        .expect(200);

      const checkinTimes = (data.body as unknown as TACheckinTimesResponse)
        .taCheckinTimes;

      const taName = ta.firstName + ' ' + ta.lastName;
      expect(checkinTimes).toStrictEqual([
        {
          checkinTime: yesterday.toISOString(),
          checkoutTime: yesterdayPlusTwoHours.toISOString(),
          forced: false,
          inProgress: false,
          name: taName,
          numHelped: 0,
        },
        {
          checkinTime: thenThreeMoreHours.toISOString(),
          checkoutTime: twelveHoursAFter.toISOString(),
          forced: true,
          inProgress: false,
          name: taName,
          numHelped: 0,
        },
        {
          checkinTime: justNow.toISOString(),
          forced: false,
          inProgress: true,
          name: taName,
          numHelped: 0,
        },
      ]);
    });
  });

  describe('DELETE /courses/:id/withdraw_course', () => {
    it('tests withdrawing from a nonexistent user course', async () => {
      await supertest({ userId: 1 })
        .delete(`/profile/1/withdraw_course`)
        .send({ email: 'yamsarecool@gmail.com', role: Role.STUDENT })
        .expect(404);
    });
    it('tests the users ability to withdraw from their own course', async () => {
      const course = await CourseFactory.create();
      // extranous student, TA, and Professor
      const userS = await UserFactory.create({
        firstName: 's',
        lastName: 's',
        email: 'stu@neu.edu',
      });
      const userT = await UserFactory.create({
        firstName: 't',
        lastName: 't',
        email: 'ta@neu.edu',
      });
      const userP = await UserFactory.create({
        firstName: 'p2',
        lastName: 'p2',
        email: 'prof2@neu.edu',
      });
      const professor = await UserFactory.create({
        firstName: 'p',
        lastName: 'p',
        email: 'profm@neu.edu',
      });

      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course,
      });

      await UserCourseFactory.create({
        user: userS,
        role: Role.STUDENT,
        course,
      });
      await UserCourseFactory.create({
        user: userT,
        role: Role.TA,
        course,
      });
      await UserCourseFactory.create({
        user: userP,
        role: Role.PROFESSOR,
        course,
      });

      await supertest({ userId: userS.id })
        .delete(`/courses/${course.id}/withdraw_course`)
        .send({ email: userS.email, role: Role.STUDENT })
        .expect(200);

      await supertest({ userId: userT.id })
        .delete(`/courses/${course.id}/withdraw_course`)
        .send({ email: userT.email, role: Role.TA })
        .expect(200);

      await supertest({ userId: userP.id })
        .delete(`/courses/${course.id}/withdraw_course`)
        .send({ email: userP.email, role: Role.PROFESSOR })
        .expect(200);

      const testSPresent = await UserCourseModel.findOne({
        where: {
          userId: userS.id,
        },
      });
      const testTPresent = await UserCourseModel.findOne({
        where: {
          userId: userT.id,
        },
      });
      const testPPresent = await UserCourseModel.findOne({
        where: {
          userId: userP.id,
        },
      });
      const userCourse = await UserCourseModel.findOne({
        where: { courseId: course.id, userId: professor.id },
      });
      expect(testSPresent).toBeUndefined();
      expect(testTPresent).toBeUndefined();
      expect(testPPresent).toBeUndefined();
      expect(userCourse).toBeDefined();
    });
  });

  describe('PATCH /courses/:id/edit_course', () => {
    // it('test patching update successfully', async () => {
    //   const professor = await UserFactory.create();
    //   const course = await CourseFactory.create();
    //   await UserCourseFactory.create({
    //     course: course,
    //     user: professor,
    //     role: Role.PROFESSOR,
    //   });

    //   await CourseSectionFactory.create({
    //     course: course,
    //     crn: 30303,
    //   });

    //   const editCourseTomato = {
    //     courseId: course.id,
    //     name: 'Tomato',
    //     icalURL: 'https://calendar.google.com/calendar/ical/tomato/basic.ics',
    //     coordinator_email: 'tomato@gmail.com',
    //     crns: [30303, 67890],
    //   };

    //   // update crns, coordinator email, name, icalURL
    //   await supertest({ userId: professor.id })
    //     .patch(`/courses/${course.id}/edit_course`)
    //     .send(editCourseTomato)
    //     .expect(200);

    //   const updatedCourse = await CourseModel.findOne({ id: course.id });

    //   expect(updatedCourse.name).toEqual('Tomato');
    //   expect(updatedCourse.coordinator_email).toEqual('tomato@gmail.com');
    //   expect(updatedCourse.icalURL).toEqual(
    //     'https://calendar.google.com/calendar/ical/tomato/basic.ics',
    //   );

    //   const crnCourseMap = await CourseSectionMappingModel.findOne({
    //     where: { crn: 67890, courseId: course.id },
    //   });
    //   expect(crnCourseMap).toBeDefined();
    // });

    it('test crn mapped to another course for a different semester', async () => {
      const professor = await UserFactory.create();
      const semester1 = await SemesterFactory.create();
      const semester2 = await SemesterFactory.create();
      const CRN = 11123;
      const potato = await CourseFactory.create({
        name: 'Potato',
        semester: semester1,
      });
      const tomato = await CourseFactory.create({
        name: 'Tomato',
        semester: semester2,
      });

      await UserCourseFactory.create({
        course: potato,
        user: professor,
        role: Role.PROFESSOR,
      });

      await UserCourseFactory.create({
        course: tomato,
        user: professor,
        role: Role.PROFESSOR,
      });

      await CourseSectionFactory.create({
        course: tomato,
        crn: CRN,
      });

      const editCourseCrn = {
        courseId: potato.id,
        crns: [CRN],
      };

      await supertest({ userId: professor.id })
        .patch(`/courses/${potato.id}/edit_course`)
        .send(editCourseCrn)
        .expect(200);
      const crnCourseMap = await CourseSectionMappingModel.findOne({
        where: { crn: CRN, courseId: potato.id },
      });
      expect(crnCourseMap).toBeDefined();
    });

    it('test conflict crn', async () => {
      const professor = await UserFactory.create();
      const semester = await SemesterFactory.create();
      const potato = await CourseFactory.create({
        name: 'Potato',
        semester: semester,
      });
      const tomato = await CourseFactory.create({
        name: 'Tomato',
        semester: semester,
      });

      await UserCourseFactory.create({
        course: potato,
        user: professor,
        role: Role.PROFESSOR,
      });

      await UserCourseFactory.create({
        course: tomato,
        user: professor,
        role: Role.PROFESSOR,
      });

      await CourseSectionFactory.create({
        course: tomato,
        crn: 12500,
      });

      const editCourseCrn = {
        courseId: potato.id,
        crns: [31000, 12500],
      };

      await supertest({ userId: professor.id })
        .patch(`/courses/${potato.id}/edit_course`)
        .send(editCourseCrn)
        .expect(400);
    });

    it('test null field', async () => {
      const professor = await UserFactory.create();
      const course = await CourseFactory.create();
      await UserCourseFactory.create({
        course: course,
        user: professor,
        role: Role.PROFESSOR,
      });

      const editCourseNull = {
        courseId: course.id,
        name: 'Tomato',
        icalURL: null,
        coordinator_email: 'tomato@gmail.com',
        crns: [12345, 67890],
      };

      await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/edit_course`)
        .send(editCourseNull)
        .expect(400);
    });
  });

  describe('POST /courses/enroll_by_invite_code/:code', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().post(`/courses/enroll_by_invite_code/123`).expect(401);
    });

    it('should return 403 if user is not found', async () => {
      const course = await CourseFactory.create();

      const resp = await supertest({ userId: 1 })
        .post(`/courses/enroll_by_invite_code/123`)
        .send({
          email: 'fake@ubc.ca',
          first_name: 'user',
          last_name: 'user',
          password: 'random_password',
          selected_course: course.id,
        });

      expect(resp.status).toBe(403);
      expect(resp.body.message).toEqual('Forbidden resource');
    });

    it('should return 404 if course is not found', async () => {
      const user = await UserFactory.create();

      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationId: organization.id,
        userId: user.id,
        organization: organization,
        organizationUser: user,
      });

      const resp = await supertest({ userId: user.id })
        .post(`/courses/enroll_by_invite_code/123`)
        .send({
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          password: 'random_password',
          selected_course: 1,
        });

      expect(resp.status).toBe(404);
      expect(resp.body.message).toEqual('The course was not found');
    });

    it('should return 400 if course invite code is incorrect', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationId: organization.id,
        userId: user.id,
        organization: organization,
        organizationUser: user,
      });

      await OrganizationCourseFactory.create({
        organizationId: organization.id,
        courseId: course.id,
        organization: organization,
        course: course,
      });

      const resp = await supertest({ userId: user.id })
        .post(`/courses/enroll_by_invite_code/invalid_course_code`)
        .send({
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          password: 'random_password',
          selected_course: course.id,
        });

      expect(resp.status).toBe(400);
      expect(resp.body.message).toEqual('Invalid invite code');
    });

    it('should return 200 if user is already enrolled in the course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationId: organization.id,
        userId: user.id,
        organization: organization,
        organizationUser: user,
      });

      await OrganizationCourseFactory.create({
        organizationId: organization.id,
        courseId: course.id,
        organization: organization,
        course: course,
      });

      await UserCourseFactory.create({
        user: user,
        course: course,
        role: Role.STUDENT,
      });

      const resp = await supertest({ userId: user.id })
        .post(`/courses/enroll_by_invite_code/${course.courseInviteCode}`)
        .send({
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          password: 'random_password',
          selected_course: course.id,
        });

      expect(resp.status).toBe(200);
    });

    it('should return 200 if user is successfully enrolled in the course', async () => {
      const user = await UserFactory.create();
      const course = await CourseFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserFactory.create({
        organizationId: organization.id,
        userId: user.id,
        organization: organization,
        organizationUser: user,
      });

      await OrganizationCourseFactory.create({
        organizationId: organization.id,
        courseId: course.id,
        organization: organization,
        course: course,
      });

      const resp = await supertest({ userId: user.id })
        .post(`/courses/enroll_by_invite_code/${course.courseInviteCode}`)
        .send({
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          password: 'random_password',
          selected_course: course.id,
        });

      expect(resp.status).toBe(200);
    });
  });

  describe('POST /courses/:id/add_student/:sid', () => {
    it('should return 403 if user is not a professor', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();

      await UserCourseFactory.create({
        course: course,
        user: student,
        role: Role.STUDENT,
      });

      await supertest({ userId: student.id })
        .post(`/courses/${course.id}/add_student/${student.id}`)
        .expect(403);
    });

    it('should return 401 if user not authorized', async () => {
      await supertest().post(`/courses/1/add_student/1`).expect(401);
    });

    it('should return 404 when user is not found', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: professor.id,
      }).save();

      await UserCourseFactory.create({
        course: course,
        user: professor,
        role: Role.PROFESSOR,
      });

      const resp = await supertest({ userId: professor.id }).post(
        `/courses/${course.id}/add_student/1`,
      );

      expect(resp.body.message).toEqual(
        'User with this student id is not found',
      );
      expect(resp.status).toBe(404);
    });

    it('should return 400 when user adds themselves', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create({ sid: 1 });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: professor.id,
      }).save();

      await UserCourseFactory.create({
        course: course,
        user: professor,
        role: Role.PROFESSOR,
      });

      const resp = await supertest({ userId: professor.id }).post(
        `/courses/${course.id}/add_student/${professor.sid}`,
      );

      expect(resp.body.message).toEqual(
        'You cannot add yourself to this course',
      );
      expect(resp.status).toBe(400);
    });

    it('should return 400 when user to add is in different organization', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      const student = await UserFactory.create({ sid: 1 });
      const organization = await OrganizationFactory.create();
      const organizationTwo = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: student.id,
      }).save();

      await OrganizationUserModel.create({
        organizationId: organizationTwo.id,
        userId: professor.id,
      }).save();

      await UserCourseFactory.create({
        course: course,
        user: professor,
        role: Role.PROFESSOR,
      });

      const resp = await supertest({ userId: professor.id }).post(
        `/courses/${course.id}/add_student/${student.sid}`,
      );
      expect(resp.body.message).toEqual('User is not in the same organization');
      expect(resp.status).toBe(400);
    });

    it('should return 200 when user is added successfully', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      const student = await UserFactory.create({ sid: 1, courses: [] });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: student.id,
      }).save();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: professor.id,
      }).save();

      await UserCourseFactory.create({
        course: course,
        user: professor,
        role: Role.PROFESSOR,
      });

      const resp = await supertest({ userId: professor.id }).post(
        `/courses/${course.id}/add_student/${student.sid}`,
      );
      expect(resp.status).toBe(200);
    });
  });

  describe('PATCH /courses/:id/update_user_role/:uid/:role', () => {
    it('should return 404 with invalid course', async () => {
      const professorUser = await UserFactory.create();
      const course = await CourseFactory.create();

      const notFoundCourseId = 123;

      await UserCourseFactory.create({
        user: professorUser,
        role: Role.PROFESSOR,
        course,
      });

      const resp = await supertest({ userId: professorUser.id }).patch(
        `/courses/${notFoundCourseId}/update_user_role/${professorUser.id}/${Role.TA}`,
      );
      expect(resp.status).toBe(404);
    });

    it('should return 404 with invalid user', async () => {
      const professorUser = await UserFactory.create();
      const course = await CourseFactory.create();

      const notFoundUserId = 123;

      await UserCourseFactory.create({
        user: professorUser,
        role: Role.PROFESSOR,
        course,
      });

      const resp = await supertest({ userId: professorUser.id }).patch(
        `/courses/${course.id}/update_user_role/${notFoundUserId}/${Role.TA}`,
      );
      expect(resp.status).toBe(404);
    });

    it('should return 400 with invalid role', async () => {
      const professorUser = await UserFactory.create();
      const course = await CourseFactory.create();

      const invalidRole = 'invalid_role';

      await UserCourseFactory.create({
        user: professorUser,
        role: Role.PROFESSOR,
        course,
      });

      const resp = await supertest({ userId: professorUser.id }).patch(
        `/courses/${course.id}/update_user_role/${professorUser.id}/${invalidRole}`,
      );
      expect(resp.status).toBe(400);
    });

    it('should return 403 if user is not a professor', async () => {
      const studentUser = await UserFactory.create();
      const course = await CourseFactory.create();

      await UserCourseFactory.create({
        user: studentUser,
        role: Role.STUDENT,
        course,
      });

      const resp = await supertest({ userId: studentUser.id }).patch(
        `/courses/${course.id}/update_user_role/${studentUser.id}/${Role.TA}`,
      );
      expect(resp.status).toBe(403);
    });

    it('should successfully update user role', async () => {
      const course = await CourseFactory.create();
      const professorUser = await UserFactory.create();
      const studentUser = await UserFactory.create();

      await UserCourseFactory.create({
        user: studentUser,
        role: Role.STUDENT,
        course,
      });

      await UserCourseFactory.create({
        user: professorUser,
        role: Role.PROFESSOR,
        course,
      });

      const resp = await supertest({ userId: professorUser.id }).patch(
        `/courses/${course.id}/update_user_role/${studentUser.id}/${Role.TA}`,
      );
      expect(resp.status).toBe(200);
      expect(resp.body.message).toEqual('Updated user course role');
    });
  });

  // course settings
  describe('PATCH /courses/:id/features', () => {
    let course;
    let student;
    let professor;
    let courseSettings;

    beforeEach(async () => {
      course = await CourseFactory.create();
      courseSettings = await CourseSettingsFactory.create({
        course: course,
      });

      //create users
      student = await UserFactory.create();
      professor = await UserFactory.create();
      // assign users to course
      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
    });

    it('should return 403 if user is not a professor', async () => {
      await supertest({ userId: student.id })
        .patch(`/courses/1/features`)
        .send({ value: false, feature: 'chatBotEnabled' })
        .expect(403);
    });

    it('should return 401 if user is not authorized', async () => {
      await supertest()
        .patch(`/courses/1/features`)
        .send({ value: false, feature: 'chatBotEnabled' })
        .expect(401);
    });

    it('should return "Not In This Course" if user is not in the course', async () => {
      const testcourse = await CourseFactory.create();
      const user = await UserFactory.create();
      const resp = await supertest({ userId: user.id })
        .patch(`/courses/${testcourse.id}/features`)
        .send({ value: true, feature: 'chatBotEnabled' });

      expect(resp.body.message).toEqual('Not In This Course');
      expect(resp.status).toBe(404);
    });

    it('should return 404 if the course is not found', async () => {
      const resp = await supertest({ userId: professor.id })
        .patch(`/courses/6969/features`)
        .send({ value: true, feature: 'chatBotEnabled' });

      expect([
        'Error while creating course settings: Course not found',
        'Not In This Course',
      ]).toContain(resp.body.message);
      expect(resp.status).toBe(404);
    });

    it('should return 400 if the feature is not valid', async () => {
      const resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: true, feature: 'invalidFeature' });

      expect(resp.body.message).toEqual([
        'feature must be one of the following values: chatBotEnabled,asyncQueueEnabled,adsEnabled,queueEnabled',
      ]);
      expect(resp.status).toBe(400);
    });

    it('should return 200 if course settings are updated successfully', async () => {
      //  DISABLE CHATBOT
      let resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: false, feature: 'chatBotEnabled' });

      expect(resp.status).toBe(200);

      // Fetch the updated courseSettings from the database
      let updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: course.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(false);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(true);
      expect(updatedCourseSettings.adsEnabled).toEqual(true);
      expect(updatedCourseSettings.queueEnabled).toEqual(true);

      //  DISABLE ASYNC QUEUE
      resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: false, feature: 'asyncQueueEnabled' });

      expect(resp.status).toBe(200);

      // Fetch the updated courseSettings from the database
      updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: course.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(false);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(false);
      expect(updatedCourseSettings.adsEnabled).toEqual(true);
      expect(updatedCourseSettings.queueEnabled).toEqual(true);

      // DISABLE ADS
      resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: false, feature: 'adsEnabled' });

      expect(resp.status).toBe(200);

      // Fetch the updated courseSettings from the database
      updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: course.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(false);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(false);
      expect(updatedCourseSettings.adsEnabled).toEqual(false);
      expect(updatedCourseSettings.queueEnabled).toEqual(true);

      // DISABLE QUEUE
      resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: false, feature: 'queueEnabled' });

      expect(resp.status).toBe(200);

      // Fetch the updated courseSettings from the database
      updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: course.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(false);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(false);
      expect(updatedCourseSettings.adsEnabled).toEqual(false);
      expect(updatedCourseSettings.queueEnabled).toEqual(false);

      // ENABLE CHATBOT
      resp = await supertest({ userId: professor.id })
        .patch(`/courses/${course.id}/features`)
        .send({ value: true, feature: 'chatBotEnabled' });

      expect(resp.status).toBe(200);

      // Fetch the updated courseSettings from the database
      updatedCourseSettings = await CourseSettingsModel.findOne({
        where: { courseId: course.id },
      });

      expect(updatedCourseSettings.chatBotEnabled).toEqual(true);
      expect(updatedCourseSettings.asyncQueueEnabled).toEqual(false);
      expect(updatedCourseSettings.adsEnabled).toEqual(false);
      expect(updatedCourseSettings.queueEnabled).toEqual(false);
    });
  });

  describe('GET /courses/:id/features', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get(`/courses/1/features`).expect(401);
    });

    it('should return "Not In This Course" if user is not in the course', async () => {
      const course = await CourseFactory.create();
      const user = await UserFactory.create();
      const resp = await supertest({ userId: user.id }).get(
        `/courses/${course.id}/features`,
      );

      expect(resp.body.message).toEqual('Not In This Course');
      expect(resp.status).toBe(404);
    });

    it('should return 200 if course settings is not found and show all features', async () => {
      const course = await CourseFactory.create();
      const professor = await UserCourseFactory.create({
        user: await UserFactory.create(),
        role: Role.PROFESSOR,
        course: course,
      });
      const resp = await supertest({ userId: professor.id }).get(
        `/courses/${course.id}/features`,
      );

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual({
        courseId: course.id,
        chatBotEnabled: true,
        asyncQueueEnabled: true,
        adsEnabled: true,
        queueEnabled: true,
        settingsFound: false,
      });
    });

    it('should return 200 and all features if features are fetched successfully', async () => {
      const course = await CourseFactory.create();
      const student = await UserCourseFactory.create({
        user: await UserFactory.create(),
        course: course,
      });
      await CourseSettingsFactory.create({
        course: course,
        chatBotEnabled: false,
        asyncQueueEnabled: false,
        adsEnabled: false,
        queueEnabled: false,
      });
      const resp = await supertest({ userId: student.id }).get(
        `/courses/${course.id}/features`,
      );

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual({
        courseId: course.id,
        chatBotEnabled: false,
        asyncQueueEnabled: false,
        adsEnabled: false,
        queueEnabled: false,
        settingsFound: true,
      });
    });
  });

  describe('GET /courses/:id/students_not_in_queue', () => {
    it('should return 401 if user is not authorized', async () => {
      await supertest().get(`/courses/1/students_not_in_queue`).expect(401);
    });
    it('should not allow students to access the endpoint', async () => {
      const course = await CourseFactory.create();
      const student = await UserFactory.create();
      await UserCourseFactory.create({
        user: student,
        role: Role.STUDENT,
        course: course,
      });

      await supertest({ userId: student.id })
        .get(`/courses/${course.id}/students_not_in_queue`)
        .expect(403);
    });
    it('should return 404 if course is not found', async () => {
      const professor = await UserFactory.create();
      await supertest({ userId: professor.id })
        .get(`/courses/1/students_not_in_queue`)
        .expect(404);
    });
    it('should return 200 and an empty array if no students are found', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/courses/${course.id}/students_not_in_queue`,
      );

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual([]);
    });
    it('should return 200 and all students if there are no queues', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const student3 = await UserFactory.create();
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course,
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/courses/${course.id}/students_not_in_queue`,
      );

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual([
        {
          id: student1.id,
          name: student1.firstName + ' ' + student1.lastName,
        },
        {
          id: student2.id,
          name: student2.firstName + ' ' + student2.lastName,
        },
      ]);
    });
    it('should return 200 and all students not in a queue', async () => {
      const course = await CourseFactory.create();
      const professor = await UserFactory.create();
      const student1 = await UserFactory.create();
      const student2 = await UserFactory.create();
      const student3 = await UserFactory.create();
      await UserCourseFactory.create({
        user: professor,
        role: Role.PROFESSOR,
        course: course,
      });
      await UserCourseFactory.create({
        user: student1,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student2,
        role: Role.STUDENT,
        course: course,
      });
      await UserCourseFactory.create({
        user: student3,
        role: Role.STUDENT,
        course: course,
      });
      const queue = await QueueFactory.create({
        course: course,
        courseId: course.id,
      });
      await QuestionFactory.create({
        queue: queue,
        status: QuestionStatusKeys.Queued,
        creatorId: student1.id,
        creator: student1,
      });
      await QuestionFactory.create({
        queue: queue,
        status: QuestionStatusKeys.Resolved,
        creatorId: student2.id,
      });

      const resp = await supertest({ userId: professor.id }).get(
        `/courses/${course.id}/students_not_in_queue`,
      );

      expect(resp.status).toBe(200);
      expect(resp.body).toEqual([
        {
          id: student2.id,
          name: student2.firstName + ' ' + student2.lastName,
        },
        {
          id: student3.id,
          name: student3.firstName + ' ' + student3.lastName,
        },
      ]);
    });
  });
});
