import { Injectable } from '@nestjs/common';
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
   * @param clear Whether to clear any existing chat data for privacy
   * @param startedAt The time the chat was started (defaults to now)
   */
  async createChat(
    queueId: number,
    staff: UserModel,
    student: UserModel,

    startedAt?: Date,
  ): Promise<void> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${student.id}`;

    // Remove any existing chat metadata and messages (in case of mismanagement; to protect previous chat history)
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
        startedAt: startedAt ?? new Date(),
      } as QueueChatPartial),
    );

    await this.redis.expire(key, 604800); // 1 week = 7 * 24 * 60 * 60 = 604800 seconds
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
      .reverse(); // Because lpush is used to "send" messages, the messages are in reverse order
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

    if (!metadata) return null;

    // Remove IDs from metadata for privacy
    delete metadata.id;
    delete metadata.student.id;
    delete metadata.staff.id;
    const messages = await this.getChatMessages(queueId, studentId);

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
    const metaKey = `${ChatMetadataRedisKey}:${queueId}:${studentId}`;
    const messageKey = `${ChatMessageRedisKey}:${queueId}:${studentId}`;

    const metadata = await this.getChatMetadata(queueId, studentId);
    const messages = await this.getChatMessages(queueId, studentId);

    // Don't bother saving if chat was not used
    if (messages && messages.length !== 0) {
      const queueChat = new QueueChatsModel();
      queueChat.queueId = queueId;
      queueChat.staffId = metadata.staff.id;
      queueChat.studentId = metadata.student.id;
      queueChat.startedAt = metadata.startedAt;
      queueChat.closedAt = new Date();
      queueChat.messageCount = messages.length;
      queueChat.save().then(async () => {
        await this.redis.del(metaKey);
        await this.redis.del(messageKey);
      });
    }
  }

  /**
   * Clear a chat from Redis (without saving metadata to database -- for unresolved but closed chats)
   * @param queueId The ID of the queue
   * @param studentId The ID of the student
   */
  async clearChat(queueId: number, studentId: number): Promise<void> {
    const metaKey = `${ChatMetadataRedisKey}:${queueId}:${studentId}`;
    const messageKey = `${ChatMessageRedisKey}:${queueId}:${studentId}`;

    await this.redis.del(metaKey);
    await this.redis.del(messageKey);
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
