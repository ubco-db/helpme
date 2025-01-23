import { setupIntegrationTest } from './util/testUtils';
import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
import {
  UserFactory,
  QueueFactory,
  TACourseFactory,
  StudentCourseFactory,
} from './util/factories';
import { UserCourseModel } from 'profile/user-course.entity';
import { QueueModel } from 'queue/queue.entity';
import { QuestionModule } from 'question/question.module';

describe('QueueChat Integration Tests', () => {
  const supertest = setupIntegrationTest(QueueChatsModule, undefined, [
    QuestionModule,
  ]);

  let student: UserCourseModel;
  let staff: UserCourseModel;
  let queue: QueueModel;

  beforeEach(async () => {
    queue = await QueueFactory.create();
    staff = await TACourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
    student = await StudentCourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
  });

  afterEach(async () => {
    await UserCourseModel.delete({});
    await QueueModel.delete({});
  });

  describe('GET /queueChats/:queueId/:studentId', () => {
    it('retrieves chat metadata and messages', async () => {
      const metadata = {
        staff: {
          id: staff.user.id,
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        },
        student: {
          id: student.user.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
        startedAt: new Date().toISOString(),
      };

      const message = {
        isStaff: true,
        message: 'Hello',
        timestamp: new Date(),
      };

      // Add data to Redis through the endpoint
      await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${student.user.id}`)
        .send({ message })
        .expect(200);

      const res = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${student.user.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        ...metadata,
        messages: [message],
      });
    });

    it('returns 404 if no metadata exists', async () => {
      await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${student.user.id}`)
        .expect(404);
    });
  });

  describe('PATCH /queueChats/:queueId/:studentId', () => {
    it('stores a new message in Redis', async () => {
      const metadata = {
        staff: {
          id: staff.user.id,
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        },
        student: {
          id: student.user.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
        startedAt: new Date().toISOString(),
      };

      // Add metadata
      await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${student.user.id}`)
        .send({ metadata });

      const message = 'Hello, student!';
      const res = await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${student.user.id}`)
        .send({ message })
        .expect(200);

      expect(res.body).toEqual({ message: 'Message sent' });

      const result = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${student.user.id}`)
        .expect(200);

      expect(result.body.messages).toEqual([
        expect.objectContaining({
          isStaff: true,
          message,
        }),
      ]);
    });

    it('returns 403 if user is not authorized', async () => {
      await supertest({ userId: 999 })
        .patch(`/queueChats/${queue.id}/${student.user.id}`)
        .send({ message: 'Unauthorized' })
        .expect(403);
    });
  });

  describe('POST /queueChats/:queueId/:studentId/end', () => {
    it('ends a chat and deletes Redis keys', async () => {
      const metadata = {
        staff: {
          id: staff.user.id,
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        },
        student: {
          id: student.user.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
        startedAt: new Date().toISOString(),
      };

      const message = {
        isStaff: true,
        message: 'Hi!',
        timestamp: new Date(),
      };

      // Add data to Redis through the endpoint
      await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${student.user.id}`)
        .send({ metadata, message })
        .expect(200);

      await supertest({ userId: staff.user.id })
        .post(`/queueChats/${queue.id}/${student.user.id}/end`)
        .expect(200);

      await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${student.user.id}`)
        .expect(404);
    });
  });
});
