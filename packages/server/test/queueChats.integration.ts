import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  QueueFactory,
  StudentCourseFactory,
  TACourseFactory,
  UserFactory,
} from './util/factories';
import { QueueChatsModel } from '../src/queueChats/queue-chats.entity';

describe('QueueChat Integration', () => {
  const supertest = setupIntegrationTest(QueueChatsModule);

  describe('GET /queueChats/:queueId/:studentId', () => {
    it('retrieves chat data when user has permission', async () => {
      const staff = await TACourseFactory.create();
      const student = await StudentCourseFactory.create();
      const queue = await QueueFactory.create();

      // Mock chat metadata in Redis
      await QueueChatsModel.create({
        queueId: queue.id,
        studentId: student.id,
        staffId: staff.id,
        startedAt: new Date('2023-01-01T00:00:00Z'),
        closedAt: null,
        messageCount: 0,
      }).save();

      const res = await supertest({ userId: staff.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00.000Z',
        messages: [],
      });
    });

    it('returns 403 if user lacks permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      await QueueChatsModel.create({
        queueId: queue.id,
        studentId: student.id,
        staffId: staff.id,
        startedAt: new Date('2023-01-01T00:00:00Z'),
      }).save();

      const unauthorizedUser = await UserFactory.create();

      await supertest({ userId: unauthorizedUser.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(403);
    });

    it('returns 404 if chat does not exist', async () => {
      const user = await UserFactory.create();
      const queue = await QueueFactory.create();
      const student = await UserFactory.create();

      await supertest({ userId: user.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(404);
    });
  });

  describe('GET /queueChats/:queueId/:studentId/sse', () => {
    it('subscribes to SSE updates', async () => {
      const staff = await TACourseFactory.create();
      const queue = await QueueFactory.create();
      const student = await UserFactory.create();

      const res = await supertest({ userId: staff.id })
        .get(`/queueChats/${queue.id}/${student.id}/sse`)
        .expect(200);

      expect(res.headers['content-type']).toBe('text/event-stream');
    });
  });

  describe('PATCH /queueChats/:queueId/:studentId', () => {
    it('sends a message when user has permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      await QueueChatsModel.create({
        queueId: queue.id,
        studentId: student.id,
        staffId: staff.id,
        startedAt: new Date('2023-01-01T00:00:00Z'),
      }).save();

      const res = await supertest({ userId: staff.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Hello, how can I help you?' })
        .expect(200);

      expect(res.body).toMatchObject({ message: 'Message sent' });
    });

    it('returns 403 when user lacks permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      await QueueChatsModel.create({
        queueId: queue.id,
        studentId: student.id,
        staffId: staff.id,
        startedAt: new Date('2023-01-01T00:00:00Z'),
      }).save();

      const unauthorizedUser = await UserFactory.create();

      await supertest({ userId: unauthorizedUser.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Hello!' })
        .expect(403);
    });

    it('returns 404 if chat metadata is not found', async () => {
      const staff = await UserFactory.create();
      const queue = await QueueFactory.create();
      const student = await UserFactory.create();

      await supertest({ userId: staff.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Hello!' })
        .expect(404);
    });
  });
});
