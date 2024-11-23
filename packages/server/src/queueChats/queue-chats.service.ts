import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { QueueChatsModel } from './queue-chats.entity';
import { UserModel } from 'profile/user.entity';
import {
  QueueChatMessagePartial,
  QueueChatPartial,
  QueueChatUserPartial,
} from '@koh/common';

const ChatMessageRedisKey = 'queue_chat_messages';
const ChatMetadataRedisKey = 'queue_chat_metadata';

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
   * @param staff The instance of the staff member
   * @param student The instance of the student
   */
  async createChat(
    queueId: number,
    staff: UserModel,
    student: UserModel,
  ): Promise<void> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${student.id}`;

    // Remove any existing chat metadata and messages
    await this.redis.del(key);
    await this.redis.del(`${ChatMessageRedisKey}:${queueId}:${student.id}`);

    await this.redis.set(
      key,
      JSON.stringify({
        staff: {
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          photoURL: staff.photoURL,
        } as QueueChatUserPartial,
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          photoURL: student.photoURL,
        } as QueueChatUserPartial,
        startedAt: new Date(),
      } as QueueChatPartial),
    );

    await this.redis.expire(key, 7200); // 2 hours = 2 * 60 * 60 = 7200 seconds
  }

  /**
   * Store a chat message in Redis
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   * @param isStaff Whether the user sending the message is staff
   * @param message The chat message to store
   *
   */
  async sendMessage(
    queueId: number,
    studentId: number,
    isStaff: boolean,
    message: string,
  ): Promise<void> {
    const key = `${ChatMessageRedisKey}:${queueId}:${studentId}`;

    const chatDataString = JSON.stringify({
      isStaff,
      message,
      timestamp: new Date(),
    } as QueueChatMessagePartial);
    await this.redis.lpush(key, chatDataString);
  }

  /**
   * Retrieve the chat metadata for a given course and queue
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   * @returns
   */
  async getChatMetadata(
    queueId: number,
    studentId: number,
  ): Promise<QueueChatPartial | null> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${studentId}`;
    const metadataString = await this.redis.get(key);
    return metadataString
      ? (JSON.parse(metadataString) as QueueChatPartial)
      : null;
  }

  /**
   * Retrieve all chat messages for a given course and queue
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   */
  async getChatMessages(
    queueId: number,
    studentId: number,
  ): Promise<QueueChatMessagePartial[] | null> {
    const key = `${ChatMessageRedisKey}:${queueId}:${studentId}`;
    const chatMessageStrings = await this.redis.lrange(key, 0, -1);
    if (chatMessageStrings.length === 0) return null;

    return chatMessageStrings
      .map((chatDataString) => {
        const message = JSON.parse(chatDataString);

        // Ensure the timestamp is a Date object
        message.timestamp = new Date(message.timestamp);

        return message;
      })
      .reverse(); // Because we used lpush, the messages are in reverse order
  }

  /**
   * For SSE, get all chat data for a given queue
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   */
  async getChatData(
    queueId: number,
    studentId: number,
  ): Promise<QueueChatPartial | null> {
    const metadata = await this.getChatMetadata(queueId, studentId);
    const messages = await this.getChatMessages(queueId, studentId);

    if (!metadata) return null;

    return {
      ...metadata,
      messages: messages,
    };
  }

  /**
   * End a chat and store the data in the database for record keeping
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   */
  async endChat(queueId: number, studentId: number): Promise<void> {
    const key = `${ChatMetadataRedisKey}:${queueId}`;

    const metadata = await this.getChatMetadata(queueId, studentId);
    const messageCount = (await this.getChatMessages(queueId, studentId))
      .length;

    // Don't bother saving if chat was not used
    if (messageCount != 0) {
      const queueChat = new QueueChatsModel();
      queueChat.queueId = queueId;
      queueChat.staffId = metadata.staff.id;
      queueChat.studentId = metadata.student.id;
      queueChat.startedAt = metadata.startedAt;
      queueChat.closedAt = new Date();
      queueChat.messageCount = messageCount;
      queueChat.save().then(async () => {
        await this.redis.del(key);
      });
    }
  }

  /**
   * Check if a user has permission to access a chat
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   * @param userId The ID of the user accessing the chat
   */
  async checkPermissions(
    queueId: number,
    studentId: number,
    userId: number,
  ): Promise<boolean> {
    const metadata = await this.getChatMetadata(queueId, studentId);
    if (!metadata) return false;
    return metadata.staff.id === userId || metadata.student.id === userId;
  }

  /**
   * Check if a chat exists for a given course and queue
   * @param queueId The ID of the queue
   */
  async checkChatExists(queueId: number, studentId: number): Promise<boolean> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${studentId}`;
    return this.redis.exists(key).then((exists) => exists === 1);
  }
}
