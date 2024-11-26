import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
import { setupIntegrationTest } from './util/testUtils';
import { QueueFactory, UserFactory } from './util/factories';

describe('QueueChat Integration', () => {
  const supertest = setupIntegrationTest(QueueChatsModule);

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    lpush: jest.fn(),
    lrange: jest.fn(),
    expire: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis globally
    jest.mock('ioredis', () => {
      return jest.fn(() => mockRedis);
    });
  });

  describe('GET /queueChats/:queueId/:studentId', () => {
    it('retrieves chat data when user has permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      const mockMetadata = {
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00Z',
      };

      const mockMessages = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello!',
          timestamp: '2023-01-01T00:01:00Z',
        }),
      ];

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMetadata));
      mockRedis.lrange.mockResolvedValueOnce(mockMessages);

      const res = await supertest({ userId: staff.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00Z',
        messages: [
          {
            isStaff: true,
            message: 'Hello!',
            timestamp: '2023-01-01T00:01:00Z',
          },
        ],
      });

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
      expect(mockRedis.lrange).toHaveBeenCalledWith(
        `queue_chat_messages:${queue.id}:${student.id}`,
        0,
        -1,
      );
    });

    it('returns 404 if chat metadata does not exist', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.lrange.mockResolvedValueOnce(null);

      await supertest({ userId: staff.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(404);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
    });

    it('returns 403 if user lacks permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const unauthorizedUser = await UserFactory.create();
      const queue = await QueueFactory.create();

      const mockMetadata = {
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMetadata));

      await supertest({ userId: unauthorizedUser.id })
        .get(`/queueChats/${queue.id}/${student.id}`)
        .expect(403);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
    });
  });

  describe('PATCH /queueChats/:queueId/:studentId', () => {
    it('sends a message when user has permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      const mockMetadata = {
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMetadata));
      mockRedis.lpush.mockResolvedValueOnce(null);

      const res = await supertest({ userId: staff.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Hello, how can I help you?' })
        .expect(200);

      expect(res.body).toMatchObject({ message: 'Message sent' });

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        `queue_chat_messages:${queue.id}:${student.id}`,
        JSON.stringify({
          isStaff: true,
          message: 'Hello, how can I help you?',
          timestamp: expect.any(String),
        }),
      );
    });

    it('returns 403 when user lacks permission', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const unauthorizedUser = await UserFactory.create();
      const queue = await QueueFactory.create();

      const mockMetadata = {
        staff: { id: staff.id },
        student: { id: student.id },
        startedAt: '2023-01-01T00:00:00Z',
      };

      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockMetadata));

      await supertest({ userId: unauthorizedUser.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Unauthorized message' })
        .expect(403);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });

    it('returns 404 if chat metadata is not found', async () => {
      const staff = await UserFactory.create();
      const student = await UserFactory.create();
      const queue = await QueueFactory.create();

      mockRedis.get.mockResolvedValueOnce(null);

      await supertest({ userId: staff.id })
        .patch(`/queueChats/${queue.id}/${student.id}`)
        .send({ message: 'Hello!' })
        .expect(404);

      expect(mockRedis.get).toHaveBeenCalledWith(
        `queue_chat_metadata:${queue.id}:${student.id}`,
      );
      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });
  });
});
