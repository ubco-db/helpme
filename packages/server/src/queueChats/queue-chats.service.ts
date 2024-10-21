import { Injectable } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { QueueChatModel } from './queue-chats.entity';
import { UserModel } from 'profile/user.entity';
import { QueueChatMessagePartial, QueueChatPartial } from '@koh/common';

interface ChatMessage {
  userId: number;
  firstName: string;
  lastName: string;
  message: string;
  timestamp: Date;
}

interface ChatMetadata {
  staffId: number;
  studentId: number;
  startedAt: Date;
  messages?: ChatMessage[];
}

@Injectable()
export class QueueChatService {
  // Redis to store temporary chat data
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient('db');
  }

  /**
   * Create a new chat in Redis
   * @param queueId The ID of the queue
   * @param staffId The ID of the staff member
   * @param studentId The ID of the student
   */
  async createChat(queueId: number, staffId: number, studentId: number) {
    const key = `queue_chats:${queueId}`;

    // Remove any existing chat data just in case
    await this.redis.del(key);

    await this.redis.lpush(
      key,
      JSON.stringify({
        staffId,
        studentId,
        startedAt: new Date(),
      } as ChatMetadata),
    );
  }

  /**
   * Store a chat message in Redis
   * @param queueId The ID of the queue
   * @param userId The ID of the user sending the message
   * @param message The chat message to store
   */
  async sendMessage(
    queueId: number,
    userId: number,
    message: string,
  ): Promise<void> {
    const key = `queue_chats:${queueId}`;

    const user = await UserModel.findOne({ where: { id: userId } });

    const chatDataString = JSON.stringify({
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      message,
      timestamp: new Date(),
    } as ChatMessage);
    await this.redis.lpush(key, chatDataString);
    await this.redis.expire(key, 7200); // 2 hours = 2 * 60 * 60 = 7200 seconds
  }

  /**
   * Retrieve the chat metadata for a given course and queue
   * @param queueId The ID of the queue
   * @returns
   */
  async getChatMetadata(queueId: number): Promise<ChatMetadata> {
    const key = `queue_chats:${queueId}`;

    const chatDataStrings = await this.redis.lrange(key, 0, -1);
    return JSON.parse(chatDataStrings[0]) as ChatMetadata;
  }

  /**
   * Retrieve all chat messages for a given course and queue
   * @param queueId The ID of the queue
   */
  async getChatMessages(queueId: number): Promise<ChatMessage[]> {
    const key = `queue_chats:${queueId}`;

    const chatDataStrings = await this.redis.lrange(key, 0, -1);
    return chatDataStrings
      .filter((_, index) => index !== 0) // Skip the metadata
      .map((chatDataString) => JSON.parse(chatDataString));
  }

  /**
   * For SSE, get all chat data for a given queue
   * @param queueId The ID of the queue
   */
  async getChatData(queueId: number): Promise<QueueChatPartial> {
    const metadata = await this.getChatMetadata(queueId);
    const messages = await this.getChatMessages(queueId);
    return {
      staffId: metadata.staffId,
      studentId: metadata.studentId,
      startedAt: metadata.startedAt,
      messages: messages.map((message) => ({
        firstName: message.firstName,
        lastName: message.lastName,
        message: message.message,
        timestamp: message.timestamp,
      })) as QueueChatMessagePartial[],
    } as QueueChatPartial;
  }

  /**
   * End a chat and store the data in the database for record keeping
   * @param queueId The ID of the queue
   */
  async endChat(queueId: number): Promise<void> {
    const key = `queue_chats:${queueId}`;

    const chatDataStrings = await this.redis.lrange(key, 0, -1);
    const metadata = JSON.parse(chatDataStrings[0]);

    const queueChat = new QueueChatModel();
    queueChat.queueId = queueId;
    queueChat.staffId = metadata.staffId;
    queueChat.studentId = metadata.studentId;
    queueChat.startedAt = metadata.startedAt;
    queueChat.closedAt = new Date();
    queueChat.messageCount = chatDataStrings.length - 1;
    queueChat.save().then(async () => {
      await this.redis.del(key);
    });
  }

  /**
   * Check if a user has permission to access a chat
   * @param queueId The ID of the queue
   */
  async checkPermissions(queueId: number, userId: number): Promise<boolean> {
    const metadata = await this.getChatMetadata(queueId);
    return metadata?.staffId === userId || metadata?.studentId === userId;
  }

  /**
   * Check if a chat exists for a given course and queue
   * @param queueId The ID of the queue
   */
  async checkChatExists(queueId: number): Promise<boolean> {
    const key = `queue_chats:${queueId}`;
    return this.redis.exists(key).then((exists) => exists === 1);
  }
}
