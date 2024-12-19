import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
import { setupIntegrationTest } from './util/testUtils';
import {
  CourseFactory,
  QueueFactory,
  UserCourseFactory,
  UserFactory,
} from './util/factories';
import { Role } from '@koh/common';
import MockRedisClient from './util/mockedRedisClient';

// PAT TODO: Figure out how to mock redis properly

// describe('QueueChat Integration', () => {
//   let mockRedis: MockRedisClient;

//   const supertest = setupIntegrationTest(QueueChatsModule, (moduleBuilder) =>
//     moduleBuilder.overrideProvider('RedisService').useValue({
//       getClient: jest.fn(() => mockRedis),
//     }),
//   );

//   beforeEach(() => {
//     // Garbage collection will handle mock deletion
//     mockRedis = new MockRedisClient();
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   })

//   describe('GET /queueChats/:queueId/:studentId', () => {
//     it('retrieves chat data when user has permission', async () => {
//       const course = await CourseFactory.create();
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();

//       await UserCourseFactory.create({
//         user: student,
//         course,
//         role: Role.STUDENT,
//       });
//       await UserCourseFactory.create({
//         user: staff,
//         course,
//         role: Role.TA,
//       });

//       const queue = await QueueFactory.create();

//       const mockMetadata = {
//         staff: { id: staff.id },
//         student: { id: student.id },
//         startedAt: '2023-01-01T00:00:00Z',
//       };
//       const mockMessages = [
//         JSON.stringify({
//           isStaff: true,
//           message: 'Hello!',
//           timestamp: '2023-01-01T00:01:00Z',
//         }),
//       ];

//       await mockRedis.set(
//         `queue_chat_metadata:${queue.id}:${student.id}`,
//         JSON.stringify(mockMetadata),
//       );
//       await mockRedis.lpush(
//         `queue_chat_messages:${queue.id}:${student.id}`,
//         ...mockMessages,
//       );

//       const res = await supertest({ userId: staff.id })
//         .get(`/queueChats/${queue.id}/${student.id}`)
//         .expect(200);

//       expect(res.body).toMatchObject({
//         staff: { id: staff.id },
//         student: { id: student.id },
//         startedAt: '2023-01-01T00:00:00Z',
//         messages: [
//           {
//             isStaff: true,
//             message: 'Hello!',
//             timestamp: '2023-01-01T00:01:00Z',
//           },
//         ],
//       });
//     });

//     it('returns 404 if chat metadata does not exist', async () => {
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();
//       const queue = await QueueFactory.create();

//       const res = await supertest({ userId: staff.id })
//         .get(`/queueChats/${queue.id}/${student.id}`)
//         .expect(404);

//       expect(res.body).toMatchObject({
//         statusCode: 404,
//         message: 'Chat not found',
//       });
//     });

//     it('returns 403 if user lacks permission', async () => {
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();
//       const unauthorizedUser = await UserFactory.create();
//       const queue = await QueueFactory.create();

//       const mockMetadata = {
//         staff: { id: staff.id },
//         student: { id: student.id },
//         startedAt: '2023-01-01T00:00:00Z',
//       };

//       await mockRedis.set(
//         `queue_chat_metadata:${queue.id}:${student.id}`,
//         JSON.stringify(mockMetadata),
//       );

//       await supertest({ userId: unauthorizedUser.id })
//         .get(`/queueChats/${queue.id}/${student.id}`)
//         .expect(403);

//       expect(mockRedis.get).toHaveBeenCalledWith(
//         `queue_chat_metadata:${queue.id}:${student.id}`,
//       );
//     });
//   });

//   describe('PATCH /queueChats/:queueId/:studentId', () => {
//     it('sends a message when user has permission', async () => {
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();
//       const queue = await QueueFactory.create();

//       const mockMetadata = {
//         staff: { id: staff.id },
//         student: { id: student.id },
//         startedAt: '2023-01-01T00:00:00Z',
//       };

//       await mockRedis.set(
//         `queue_chat_metadata:${queue.id}:${student.id}`,
//         JSON.stringify(mockMetadata),
//       );

//       const res = await supertest({ userId: staff.id })
//         .patch(`/queueChats/${queue.id}/${student.id}`)
//         .send({ message: 'Hello, how can I help you?' })
//         .expect(200);

//       expect(res.body).toMatchObject({ message: 'Message sent' });

//       expect(mockRedis.lpush).toHaveBeenCalledWith(
//         `queue_chat_messages:${queue.id}:${student.id}`,
//         JSON.stringify({
//           isStaff: true,
//           message: 'Hello, how can I help you?',
//           timestamp: expect.any(String),
//         }),
//       );
//     });

//     it('returns 403 when user lacks permission', async () => {
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();
//       const unauthorizedUser = await UserFactory.create();
//       const queue = await QueueFactory.create();

//       const mockMetadata = {
//         staff: { id: staff.id },
//         student: { id: student.id },
//         startedAt: '2023-01-01T00:00:00Z',
//       };

//       await mockRedis.set(
//         `queue_chat_metadata:${queue.id}:${student.id}`,
//         JSON.stringify(mockMetadata),
//       );

//       await supertest({ userId: unauthorizedUser.id })
//         .patch(`/queueChats/${queue.id}/${student.id}`)
//         .send({ message: 'Unauthorized message' })
//         .expect(403);

//       expect(mockRedis.lpush).not.toHaveBeenCalled();
//     });

//     it('returns 404 if chat metadata is not found', async () => {
//       const staff = await UserFactory.create();
//       const student = await UserFactory.create();
//       const queue = await QueueFactory.create();

//       const res = await supertest({ userId: staff.id })
//         .patch(`/queueChats/${queue.id}/${student.id}`)
//         .send({ message: 'Hello!' })
//         .expect(404);

//       expect(mockRedis.lpush).not.toHaveBeenCalled();
//     });
//   });
// });
