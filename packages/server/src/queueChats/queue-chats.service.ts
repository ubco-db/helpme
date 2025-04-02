import {
  HttpException,
  HttpStatus,
  Injectable,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { RedisService } from 'nestjs-redis';
import { Redis } from 'ioredis';
import { QueueChatsModel } from './queue-chats.entity';
import { UserModel } from 'profile/user.entity';
import {
  ERROR_MESSAGES,
  OpenQuestionStatus,
  QueueChatMessagePartial,
  QueueChatPartial,
  QueueChatUserPartial,
  Role,
  StatusInQueue,
} from '@koh/common';
import { QuestionModel } from 'question/question.entity';
import { In } from 'typeorm';
import { QueueSSEService } from 'queue/queue-sse.service';
const ChatMessageRedisKey = 'queue_chat_messages';
const ChatMetadataRedisKey = 'queue_chat_metadata';

@Injectable()
export class QueueChatService {
  // Redis to store temporary chat data
  private readonly redis: Redis;

  constructor(
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => QueueSSEService))
    private readonly queueSSEService: QueueSSEService,
  ) {
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
  ): Promise<QueueChatPartial> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${question.id}:${staff.id}`;

    // Remove any existing chat metadata and messages (in case of mismanagement; to protect previous chat history)
    await this.redis.del(key).catch((error) => {
      if (error) {
        console.error(error);
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.failureToClearChat,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
    await this.redis
      .del(`${ChatMessageRedisKey}:${queueId}:${question.id}:${staff.id}`)
      .catch((error) => {
        if (error) {
          console.error(error);
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

    const queueChatMetadata = {
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
      questionId: question.id,
    } as QueueChatPartial;

    await this.redis
      .set(key, JSON.stringify(queueChatMetadata))
      .catch((error) => {
        if (error) {
          console.error(error);
          throw new HttpException(
            ERROR_MESSAGES.queueChatsController.failureToCreateChat,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      });

    await this.redis.expire(key, 86400); // 1 day = 24 * 60 * 60 = 86400 seconds
    return queueChatMetadata;
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
    staffId: number,
    isStaff: boolean,
    message: string,
  ): Promise<void> {
    const key = `${ChatMessageRedisKey}:${queueId}:${questionId}:${staffId}`;

    const chatDataString = JSON.stringify({
      isStaff,
      message,
      timestamp: new Date(),
    } as QueueChatMessagePartial);
    await this.redis.lpush(key, chatDataString).catch((error) => {
      if (error) {
        console.error(error);
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.failureToSendMessage,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  }

  async getNumberOfMessages(
    queueId: number,
    questionId: number,
    staffId: number,
  ): Promise<number | null> {
    const key = `${ChatMessageRedisKey}:${queueId}:${questionId}:${staffId}`;
    return this.redis.llen(key).catch((error) => {
      if (error) {
        console.error(error);
        return null;
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
    staffId: number,
  ): Promise<QueueChatPartial | null> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${questionId}:${staffId}`;
    const metadataString = await this.redis.get(key).catch((error) => {
      if (error) {
        console.error(error);
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
    staffId: number,
  ): Promise<QueueChatMessagePartial[] | null> {
    const key = `${ChatMessageRedisKey}:${queueId}:${questionId}:${staffId}`;
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
   * @param staffId The ID of the staff member
   */
  async getChatData(
    queueId: number,
    questionId: number,
    staffId: number,
  ): Promise<QueueChatPartial | null> {
    const metadata = await this.getChatMetadata(queueId, questionId, staffId);
    if (!metadata) return null;

    // Remove IDs from metadata for privacy
    delete metadata.id;
    delete metadata.student.id;
    delete metadata.staff.id;
    const messages = await this.getChatMessages(queueId, questionId, staffId);

    return {
      ...metadata,
      messages: messages,
    };
  }

  /* used by students to get all the chats they have for their question */
  async getChatsForQuestion(
    queueId: number,
    questionId: number,
  ): Promise<QueueChatPartial[]> {
    // get all chats for the question, then map over them to get all the staffIds, then get the metadata for each staffId and return it
    const chats = await this.redis.keys(
      `${ChatMetadataRedisKey}:${queueId}:${questionId}:*`,
    );
    const chatMetadatas = [];
    for (const chatKey of chats) {
      const staffId = Number(chatKey.split(':')[3]);
      const metadata = await this.getChatMetadata(queueId, questionId, staffId);
      if (metadata) {
        chatMetadatas.push(metadata);
      }
    }
    return chatMetadatas;
  }

  /* used by staff to get all the chats they have for a given queue and user */
  async getChatsForGivenStaffId(
    queueId: number,
    staffId: number,
  ): Promise<QueueChatPartial[]> {
    // get all chats for the queue, then map over them to get all the questionIds, then get the metadata for each questionId and return it
    const chats = await this.redis.keys(
      `${ChatMetadataRedisKey}:${queueId}:*:${staffId}`,
    );
    const chatMetadatas = [];
    for (const chatKey of chats) {
      const questionId = Number(chatKey.split(':')[2]);
      const metadata = await this.getChatMetadata(queueId, questionId, staffId);
      if (metadata) {
        chatMetadatas.push(metadata);
      }
    }
    return chatMetadatas;
  }

  async getMyChats(
    queueId: number,
    myRole: Role,
    userId: number,
  ): Promise<QueueChatPartial[]> {
    if (myRole === Role.STUDENT) {
      // if i'm a student, find my question
      const question = await QuestionModel.findOne({
        where: {
          creatorId: userId,
          queueId: queueId,
          status: In(StatusInQueue),
          isTaskQuestion: false,
        },
      });
      if (!question) return [];

      return this.getChatsForQuestion(queueId, question.id);
    } else {
      // if i'm staff, get all chats with my staffId
      return this.getChatsForGivenStaffId(queueId, userId);
    }
  }

  /**
   * End all chats for a given question and store the data in the database for record keeping
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async endChats(queueId: number, questionId: number): Promise<void> {
    // Get all chats for the question
    const metaKeys = await this.redis.keys(
      `${ChatMetadataRedisKey}:${queueId}:${questionId}:*`,
    );

    // Process all chats in parallel
    const savePromises = metaKeys.map(async (metaKey) => {
      const staffId = Number(metaKey.split(':')[3]);
      if (isNaN(staffId)) return null;

      const metadata = await this.getChatMetadata(queueId, questionId, staffId);
      const messages = await this.getChatMessages(queueId, questionId, staffId);
      const messageKey = `${ChatMessageRedisKey}:${queueId}:${questionId}:${staffId}`;

      // Only save to database if there are messages
      if (messages && messages.length > 0) {
        // Create and save chat record
        const queueChat = new QueueChatsModel();
        queueChat.queueId = queueId;
        queueChat.staffId = metadata.staff.id;
        queueChat.studentId = metadata.student.id;
        queueChat.startedAt = metadata.startedAt;
        queueChat.closedAt = new Date();
        queueChat.messageCount = messages.length;

        // Save to database
        await queueChat.save();
      }

      // Return keys to delete after saving
      return { metaKey, messageKey };
    });

    // Wait for all saves to complete and collect keys to delete
    const keysToDelete = (await Promise.all(savePromises)).filter(Boolean);

    // Batch delete Redis keys using pipeline
    if (keysToDelete.length > 0) {
      const pipeline = this.redis.pipeline();

      keysToDelete.forEach((keys) => {
        pipeline.del(keys.metaKey);
        pipeline.del(keys.messageKey);
      });

      try {
        await pipeline.exec();
      } catch (error) {
        throw new HttpException(
          ERROR_MESSAGES.queueChatsController.failureToClearChat,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    console.log(
      `Deleted ${keysToDelete.length} queue chats for question id ${questionId}`,
    );

    // now notify everyone in the queue to re-fetch their chats
    await this.queueSSEService.updateQueueChats(queueId);
  }

  /**
   * Clear a chat from Redis (without saving metadata to database -- for unresolved but closed chats)
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   */
  async clearChats(queueId: number, questionId: number): Promise<void> {
    const metaKeys = await this.redis.keys(
      `${ChatMetadataRedisKey}:${queueId}:${questionId}:*`,
    );
    const messageKeys = await this.redis.keys(
      `${ChatMessageRedisKey}:${queueId}:${questionId}:*`,
    );

    // Using pipeline to batch delete operations
    const pipeline = this.redis.pipeline();

    // UNLINK is non-blocking - it removes keys in the background
    metaKeys.forEach((key) => pipeline.unlink(key));
    messageKeys.forEach((key) => pipeline.unlink(key));

    await pipeline.exec();
    await this.queueSSEService.updateQueueChats(queueId);
  }

  /**
   * Check if a user has permission to access a chat
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   * @param staffId The ID of the staff member
   * @param userId The ID of the user accessing the chat
   */
  async checkPermissions(
    queueId: number,
    questionId: number,
    staffId: number,
    userId: number,
  ): Promise<boolean> {
    const metadata = await this.getChatMetadata(queueId, questionId, staffId);
    if (!metadata) return false;
    return metadata.staff.id === userId || metadata.student.id === userId;
  }

  /**
   * Check if a chat exists for a given course and queue
   * @param queueId The ID of the queue
   * @param questionId The ID of the question
   * @param staffId The ID of the staff member
   */
  async checkChatExists(
    queueId: number,
    questionId: number,
    staffId: number,
  ): Promise<boolean> {
    const key = `${ChatMetadataRedisKey}:${queueId}:${questionId}:${staffId}`;
    return this.redis.exists(key).then((exists) => exists === 1);
  }
}
