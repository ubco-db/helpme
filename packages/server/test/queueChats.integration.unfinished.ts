// import { Test, TestingModule } from '@nestjs/testing';
// import { CACHE_MANAGER } from '@nestjs/common';
// import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
// import supertest from 'supertest';
// import RedisMock from 'ioredis-mock';
// import { setupIntegrationTest } from './util/testUtils';

// describe('QueueChat Integration', () => {
//   jest.mock('ioredis', () => require('ioredis-mock/jest'));

//   const supertest = setupIntegrationTest(QueueChatsModule);
//   const redisClient = new RedisMock({
//     port: 6759, // PAT TODO: redis port and address here
//     host: 'localhost',
//     data: {},
//   });

//   beforeEach(async () => {

//   });

//   afterEach(() => {
//     redisClient.flushall(); // Reset the mock Redis instance after each test
//   });

//   describe('GET /queueChats/:queueId/:studentId', () => {
//     it('retrieves chat data when user has permission', async () => {
//       const queueId = 1;
//       const studentId = 123;
//       const staffId = 456;

//       // Mock Redis cache responses
//       const mockMetadata = {
//         staff: { id: staffId },
//         student: { id: studentId },
//         startedAt: '2023-01-01T00:00:00Z',
//       };
//       const mockMessages = [
//         {
//           isStaff: true,
//           message: 'Hello!',
//           timestamp: '2023-01-01T00:01:00Z',
//         },
//       ];

//       cache.get.mockResolvedValueOnce(mockMetadata); // Mock `get()` return value
//       cache.lpush.mockResolvedValueOnce(mockMessages); // Mock `lpush()`

//       const res = await supertest({ userId: staffId })
//         .get(`/queueChats/${queueId}/${studentId}`)
//         .expect(200);

//       expect(res.body).toMatchObject({
//         staff: { id: staffId },
//         student: { id: studentId },
//         startedAt: '2023-01-01T00:00:00Z',
//         messages: mockMessages,
//       });
//       expect(cache.get).toHaveBeenCalledWith(
//         `queue_chat_metadata:${queueId}:${studentId}`,
//       );
//     });

//     it('returns 404 if chat metadata does not exist', async () => {
//       cache.get.mockResolvedValueOnce(null); // Mock Redis returning null

//       const res = await supertest({ userId: 456 })
//         .get(`/queueChats/1/123`)
//         .expect(404);

//       expect(res.body).toMatchObject({
//         statusCode: 404,
//         message: 'Chat not found',
//       });
//     });
//   });

//   describe('PATCH /queueChats/:queueId/:studentId', () => {
//     it('sends a message when user has permission', async () => {
//       const queueId = 1;
//       const studentId = 123;
//       const staffId = 456;

//       cache.get.mockResolvedValueOnce({
//         staff: { id: staffId },
//         student: { id: studentId },
//         startedAt: '2023-01-01T00:00:00Z',
//       });

//       const res = await supertest({ userId: staffId })
//         .patch(`/queueChats/${queueId}/${studentId}`)
//         .send({ message: 'Hello, how can I help you?' })
//         .expect(200);

//       expect(res.body).toMatchObject({ message: 'Message sent' });
//       expect(cache.lpush).toHaveBeenCalledWith(
//         `queue_chat_messages:${queueId}:${studentId}`,
//         expect.stringContaining('Hello, how can I help you?'),
//       );
//     });

//     it('returns 404 when metadata is missing', async () => {
//       cache.get.mockResolvedValueOnce(null); // Metadata not found

//       const res = await supertest({ userId: 456 })
//         .patch(`/queueChats/1/123`)
//         .send({ message: 'Hello!' })
//         .expect(404);

//       expect(cache.lpush).not.toHaveBeenCalled();
//     });
//   });
// });
