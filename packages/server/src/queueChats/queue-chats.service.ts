import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { QueueChatModel } from './queue-chats.entity';
import { UserModel } from 'profile/user.entity';

@Injectable()
export class QueueChatService {
  // Redis to store temporary chat data
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient('db');
  }

  /**
   * Create a new chat in Redis
   * @param courseId The ID of the course
   * @param queueId The ID of the queue
   * @param staffId The ID of the staff member
   * @param studentId The ID of the student
   */
  async createChat(
    courseId: number,
    queueId: number,
    staffId: number,
    studentId: number,
  ) {
    const key = `chat:${courseId}:${queueId}`;

    // Remove any existing chat data just in case
    await this.redis.del(key);

    await this.redis.lpush(
      key,
      JSON.stringify({
        staffId,
        studentId,
        startedAt: new Date(),
      }),
    );
  }

  /**
   * Store a chat message in Redis
   * @param courseId The ID of the course
   * @param queueId The ID of the queue
   * @param userId The ID of the user sending the message
   * @param message The chat message to store
   */
  async sendMessage(
    courseId: number,
    queueId: number,
    userId: number,
    message: string,
  ): Promise<void> {
    const key = `chat:${courseId}:${queueId}`;

    const user = await UserModel.findOne({ where: { id: userId } });

    const chatDataString = JSON.stringify({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      message,
      timestamp: new Date().toISOString(),
    });
    await this.redis.lpush(key, chatDataString);
    await this.redis.expire(key, 7200); // 2 hours = 2 * 60 * 60 = 7200 seconds
  }

  /**
   * Retrieve all chat messages for a given course and queue
   * @param courseId The ID of the course
   * @param queueId The ID of the queue
   */
  async getChatMessages(courseId: number, queueId: number): Promise<string[]> {
    const key = `chat:${courseId}:${queueId}`;

    const chatDataStrings = await this.redis.lrange(key, 0, -1);
    return chatDataStrings.map((chatDataString, index) => {
      // Filter out chat metadata
      if (index != 0) {
        return JSON.parse(chatDataString);
      }
    });
  }

  async endQueueChat(
    courseId,
    queueId: number,
    staffId: number,
    studentId: number,
    startedAt: Date,
  ) {
    const key = `chat:${courseId}:${queueId}`;

    const chatDataStrings = await this.redis.lrange(key, 0, -1);
    const metadata = JSON.parse(chatDataStrings[0]);

    const queueChat = new QueueChatModel();
    queueChat.queueId = queueId;
    queueChat.courseId = courseId;
    queueChat.staffId = metadata.staffId;
    queueChat.studentId = metadata.studentId;
    queueChat.startedAt = metadata.startedAt;
    queueChat.closedAt = new Date();
    queueChat.messageCount = chatDataStrings.length - 1;
    queueChat.save().then(async () => {
      await this.redis.del(key);
    });
  }
}
