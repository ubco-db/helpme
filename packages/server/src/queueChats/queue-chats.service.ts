import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { QueueChatsModel } from './queue-chats.entity';
import { UserModel } from 'profile/user.entity';
import {
  ERROR_MESSAGES,
  QueueChatMessagePartial,
  QueueChatPartial,
  QueueChatUserPartial,
} from '@koh/common';
import { QuestionModel } from 'question/question.entity';
import { RedisService } from '@liaoliaots/nestjs-redis';

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
   * @param staff The entity of the staff member
   * @param question The entity of the question
   * @param startedAt The time the chat was started (defaults to now)
   */
  async createChat(
    queueId: number,
    staff: UserModel,
    question: QuestionModel,
    startedAt?: Date,
  ): Promise<void> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${question.id}`;

    // Remove any existing chat metadata and messages (in case of mismanagement; to protect previous chat history)
    await this.redis.del(key).catch((error) => {
      if (error) {
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.failureToClearChat,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
    await this.redis
      .del(`${ChatMessageRedisKey}:${queueId}:${question.id}`)
      .catch((error) => {
        if (error) {
          throw new HttpException(
            ERROR_MESSAGES.queueChatsController.failureToClearChat,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      });

    // Since it isn't guaranteed that the creator relation will be populated
    const creator = await UserModel.findOne({
      where: { id: question.creatorId },
    });

    await this.redis
      .set(
        key,
        JSON.stringify({
          staff: {
            id: staff.id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            photoURL: staff.photoURL,
          } as QueueChatUserPartial,
          student: {
            id: creator.id,
            firstName: creator.firstName,
            lastName: creator.lastName,
            photoURL: creator.photoURL,
          } as QueueChatUserPartial,
          startedAt: startedAt ?? new Date(),
        } as QueueChatPartial),
      )
      .catch((error) => {
        if (error) {
          throw new HttpException(
            ERROR_MESSAGES.queueChatsController.failureToCreateChat,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      });

    await this.redis.expire(key, 604800); // 1 week = 7 * 24 * 60 * 60 = 604800 seconds
  }

  /**
   * Store a chat message in Redis
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   * @param isStaff Whether the user sending the message is staff
   * @param message The chat message to store
   *
   */
  async sendMessage(
    queueId: number,
    questionId: number,
    isStaff: boolean,
    message: string,
  ): Promise<void> {
    const key = `${ChatMessageRedisKey}:${queueId}:${questionId}`;

    const chatDataString = JSON.stringify({
      isStaff,
      message,
      timestamp: new Date(),
    } as QueueChatMessagePartial);
    await this.redis.lpush(key, chatDataString).catch((error) => {
      if (error) {
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.failureToSendMessage,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  }

  /**
   * Retrieve the chat metadata for a given course and queue
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   * @returns
   */
  async getChatMetadata(
    queueId: number,
    questionId: number,
  ): Promise<QueueChatPartial | null> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${questionId}`;
    const metadataString = await this.redis.get(key).catch((error) => {
      if (error) {
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.chatNotFound,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
    return metadataString
      ? (JSON.parse(metadataString) as QueueChatPartial)
      : null;
  }

  /**
   * Retrieve all chat messages for a given course and queue
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async getChatMessages(
    queueId: number,
    questionId: number,
  ): Promise<QueueChatMessagePartial[] | null> {
    const key = `${ChatMessageRedisKey}:${queueId}:${questionId}`;
    const chatMessageStrings = await this.redis
      .lrange(key, 0, -1)
      .catch((error) => {
        if (error) {
          console.error(error);
          throw new HttpException(
            ERROR_MESSAGES.queueChatsController.chatNotFound,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      });
    if (!chatMessageStrings || chatMessageStrings.length === 0) return null;

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
   * @param questionId The ID of the question
   */
  async getChatData(
    queueId: number,
    questionId: number,
  ): Promise<QueueChatPartial | null> {
    const metadata = await this.getChatMetadata(queueId, questionId);

    if (!metadata) return null;

    // Remove IDs from metadata for privacy
    delete metadata.id;
    delete metadata.student.id;
    delete metadata.staff.id;
    const messages = await this.getChatMessages(queueId, questionId);

    return {
      ...metadata,
      messages: messages,
    };
  }

  /**
   * End a chat and store the data in the database for record keeping
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async endChat(queueId: number, questionId: number): Promise<void> {
    const metaKey = `${ChatMetadataRedisKey}:${queueId}:${questionId}`;
    const messageKey = `${ChatMessageRedisKey}:${queueId}:${questionId}`;

    const metadata = await this.getChatMetadata(queueId, questionId);
    const messages = await this.getChatMessages(queueId, questionId);

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
        await this.redis.del(metaKey).catch((error) => {
          if (error) {
            throw new HttpException(
              ERROR_MESSAGES.queueChatsController.failureToClearChat,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
        });
        await this.redis.del(messageKey).catch((error) => {
          if (error) {
            throw new HttpException(
              ERROR_MESSAGES.queueChatsController.failureToClearChat,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          }
        });
      });
    }
  }

  /**
   * Clear a chat from Redis (without saving metadata to database -- for unresolved but closed chats)
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async clearChat(queueId: number, questionId: number): Promise<void> {
    const metaKey = `${ChatMetadataRedisKey}:${queueId}:${questionId}`;
    const messageKey = `${ChatMessageRedisKey}:${queueId}:${questionId}`;

    await this.redis.del(metaKey);
    await this.redis.del(messageKey);
  }

  /**
   * Check if a user has permission to access a chat
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   * @param userId The ID of the user accessing the chat
   */
  async checkPermissions(
    queueId: number,
    questionId: number,
    userId: number,
  ): Promise<boolean> {
    const metadata = await this.getChatMetadata(queueId, questionId);
    if (!metadata) return false;
    return metadata.staff.id === userId || metadata.student.id === userId;
  }

  /**
   * Check if a chat exists for a given course and queue
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async checkChatExists(queueId: number, questionId: number): Promise<boolean> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${questionId}`;
    return this.redis.exists(key).then((exists) => exists === 1);
  }
}
