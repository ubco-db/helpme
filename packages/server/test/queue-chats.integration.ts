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

describe('QueueChat Integration Tests', () => {
  const { supertest, getTestModule } = setupIntegrationTest(
    QueueChatsModule,
    undefined,
    [QuestionModule],
  );

  let student: UserCourseModel;
  let staff: UserCourseModel;
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
  });

  afterEach(async () => {
    await QuestionModel.remove(question);
    await QueueModel.remove(queue);
    await UserCourseModel.remove(staff);
    await UserCourseModel.remove(student);
    await UserModel.remove(staff.user);
    await UserModel.remove(student.user);

    await redisService.getClient('db').flushall();
  });

  afterAll(async () => {
    await getTestModule().close();
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
