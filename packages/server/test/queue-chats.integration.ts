import { setupIntegrationTest } from './util/testUtils';
import { QueueChatsModule } from '../src/queueChats/queue-chats.module';
import {
  UserFactory,
  QueueFactory,
  TACourseFactory,
  StudentCourseFactory,
  QuestionFactory,
} from './util/factories';
import { UserCourseModel } from 'profile/user-course.entity';
import { QueueModel } from 'queue/queue.entity';
import { QuestionModule } from 'question/question.module';
import { RedisService } from 'nestjs-redis';
import { QuestionModel } from 'question/question.entity';
import { UserModel } from 'profile/user.entity';
import { QueueChatService } from 'queueChats/queue-chats.service';
import { QueueChatSSEService } from 'queueChats/queue-chats-sse.service';

describe('QueueChat Integration Tests', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    QueueChatsModule,
    undefined,
    [QuestionModule],
  );

  let student: UserCourseModel;
  let staff: UserCourseModel;
  let otherStudent: UserCourseModel;
  let otherStaff: UserCourseModel;
  let queue: QueueModel;
  let question: QuestionModel;
  let queueChatService: QueueChatService;
  let redisService: RedisService;

  beforeEach(async () => {
    const testModule = getTestModule();
    queueChatService = testModule.get<QueueChatService>(QueueChatService);
    redisService = testModule.get<RedisService>(RedisService);

    question = await QuestionFactory.create();
    queue = await question.queue;
    staff = await TACourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
    student = await StudentCourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
    otherStaff = await TACourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
    otherStudent = await StudentCourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });

    question.creator = student.user;
    question.taHelped = staff.user;
    await question.save();
  });

  afterEach(async () => {
    await QuestionModel.remove(question);
    await QueueModel.remove(queue);
    await UserCourseModel.remove(staff);
    await UserCourseModel.remove(student);
    await UserCourseModel.remove(otherStaff);
    await UserCourseModel.remove(otherStudent);
    await UserModel.remove(staff.user);
    await UserModel.remove(student.user);
    await UserModel.remove(otherStaff.user);
    await UserModel.remove(otherStudent.user);

    question = await QuestionFactory.create();
    queue = await question.queue;
    staff = await TACourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
    student = await StudentCourseFactory.create({
      course: queue.course,
      user: await UserFactory.create(),
    });
  });

  describe('GET /queueChats/:queueId/:questionId', () => {
    it('retrieves chat metadata and messages', async () => {
      const metadata = {
        staff: {
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        },
        student: {
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
        startedAt: new Date('2021-01-01T00:00:00Z').toISOString(),
      };

      const messageObj = {
        isStaff: true,
        message: 'Testing, testing, 1, 2, 3...',
        // Don't compare timestamp for obvious reasons
      };

      // Add data to Redis through the endpoint
      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date(metadata.startedAt),
      );

      await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}`)
        .send({ message: messageObj.message });

      const res = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        ...metadata,
        messages: [messageObj],
      });
    });

    it('returns 404 if no chat metadata or messages exist', async () => {
      await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}`)
        .expect(404);
    });
  });

  describe('POST /queueChats/:queueId/:questionId/:staffId', () => {
    it('creates a new chat for a valid staff and question', async () => {
      const res = await supertest({ userId: staff.user.id })
        .post(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(201);

      expect(res.body).toMatchObject({
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
        questionId: question.id,
      });

      // Verify chat exists in Redis
      const chatExists = await queueChatService.checkChatExists(
        queue.id,
        question.id,
        staff.user.id,
      );
      expect(chatExists).toBe(true);
    });

    it('returns 400 if chat already exists', async () => {
      // Create chat first
      await queueChatService.createChat(queue.id, staff.user, question);

      // Try to create again
      await supertest({ userId: staff.user.id })
        .post(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(400);
    });

    it('returns 404 if queue not found', async () => {
      await supertest({ userId: staff.user.id })
        .post(`/queueChats/9999/${question.id}/${staff.user.id}`)
        .expect(404);
    });

    it('returns 404 if question not found', async () => {
      await supertest({ userId: staff.user.id })
        .post(`/queueChats/${queue.id}/9999/${staff.user.id}`)
        .expect(404);
    });

    it('returns 404 if staff not found', async () => {
      await supertest({ userId: staff.user.id })
        .post(`/queueChats/${queue.id}/${question.id}/9999`)
        .expect(404);
    });

    it('returns 403 if student tries to create chat for another student', async () => {
      // Create another student with their own question
      const otherQuestion = await QuestionFactory.create({ queue });
      otherQuestion.creator = otherStudent.user;
      await otherQuestion.save();

      // Student tries to create chat for another student's question
      await supertest({ userId: student.user.id })
        .post(`/queueChats/${queue.id}/${otherQuestion.id}/${staff.user.id}`)
        .expect(403);

      await QuestionModel.remove(otherQuestion);
    });
  });

  describe('GET /queueChats/:queueId/:questionId/:staffId', () => {
    it('retrieves specific chat data', async () => {
      // Create chat
      await queueChatService.createChat(queue.id, staff.user, question);

      // Add a message
      await queueChatService.sendMessage(
        queue.id,
        question.id,
        staff.user.id,
        true,
        'Hello student!',
      );

      // Get chat as staff
      const res = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(200);

      expect(res.body).toMatchObject({
        staff: {
          firstName: staff.user.firstName,
          lastName: staff.user.lastName,
        },
        student: {
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
        messages: [
          {
            isStaff: true,
            message: 'Hello student!',
          },
        ],
      });
    });

    it('returns 404 if chat does not exist', async () => {
      await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(404);
    });

    it('returns 403 if user is not authorized to view chat', async () => {
      // Create chat
      await queueChatService.createChat(queue.id, staff.user, question);

      // Different student tries to access
      await supertest({ userId: otherStudent.user.id })
        .get(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(403);
    });
  });

  describe('GET /queueChats/:queueId', () => {
    it('returns all chats for a staff member', async () => {
      // Create multiple chats for the staff
      await queueChatService.createChat(queue.id, staff.user, question);

      // Create another question
      const anotherQuestion = await QuestionFactory.create({ queue });
      anotherQuestion.creator = otherStudent.user;
      await anotherQuestion.save();

      await queueChatService.createChat(queue.id, staff.user, anotherQuestion);

      // Get all chats for the staff
      const res = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('questionId');
      expect(res.body[1]).toHaveProperty('questionId');

      await QuestionModel.remove(anotherQuestion);
    });

    it('returns all chats for a student', async () => {
      // Create multiple chats with different staff for the student's question
      await queueChatService.createChat(queue.id, staff.user, question);
      await queueChatService.createChat(queue.id, otherStaff.user, question);

      // Get all chats for the student
      const res = await supertest({ userId: student.user.id })
        .get(`/queueChats/${queue.id}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('returns empty array if no chats exist', async () => {
      const res = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('PATCH /queueChats/:queueId/:questionId/:staffId', () => {
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
        startedAt: new Date('2021-01-01T00:00:00Z').toISOString(),
      };

      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date(metadata.startedAt),
      );

      const message = 'Hello, student!';
      const res = await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .send({ message })
        .expect(200);

      expect(res.body).toEqual({ message: 'Message sent' });

      const result = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(200);

      expect(result.body.messages).toEqual([
        expect.objectContaining({
          isStaff: true,
          message,
        }),
      ]);
    });

    it('allows student to send message', async () => {
      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date('2021-01-01T00:00:00Z'),
      );

      const message = 'Hello, professor!';
      await supertest({ userId: student.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .send({ message })
        .expect(200);

      const result = await supertest({ userId: student.user.id })
        .get(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .expect(200);

      expect(result.body.messages).toEqual([
        expect.objectContaining({
          isStaff: false,
          message,
        }),
      ]);
    });

    it('returns 404 if chat does not exist', async () => {
      await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .send({ message: 'Hello?' })
        .expect(404);
    });

    it('returns 403 if user is not authorized', async () => {
      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date('2021-01-01T00:00:00Z'),
      );

      await supertest({ userId: otherStudent.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}/${staff.user.id}`)
        .send({ message: 'Unauthorized' })
        .expect(403);
    });
  });

  describe('PATCH /queueChats/:queueId/:questionId', () => {
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
        startedAt: new Date('2021-01-01T00:00:00Z').toISOString(),
      };

      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date(metadata.startedAt),
      );

      const message = 'Hello, student!';
      const res = await supertest({ userId: staff.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}`)
        .send({ message })
        .expect(200);

      expect(res.body).toEqual({ message: 'Message sent' });

      const result = await supertest({ userId: staff.user.id })
        .get(`/queueChats/${queue.id}/${question.id}`)
        .expect(200);

      expect(result.body.messages).toEqual([
        expect.objectContaining({
          isStaff: true,
          message,
        }),
      ]);
    });

    it('returns 403 if user is not authorized', async () => {
      const otherStudent = await StudentCourseFactory.create({
        course: queue.course,
        user: await UserFactory.create(),
      });

      await queueChatService.createChat(
        queue.id,
        staff.user,
        question,
        new Date('2021-01-01T00:00:00Z'),
      );

      await supertest({ userId: otherStudent.user.id })
        .patch(`/queueChats/${queue.id}/${question.id}`)
        .send({ message: 'Unauthorized' })
        .expect(403);
    });
  });
});
