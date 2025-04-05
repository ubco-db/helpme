import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from 'nestjs-redis';
import { QueueChatService } from './queue-chats.service';
import { QueueChatsModel } from './queue-chats.entity';
import { Connection } from 'typeorm';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { ApplicationTestingConfigModule } from '../config/application_config.module';
import { QuestionFactory, UserFactory } from '../../test/util/factories';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueSSEService } from 'queue/queue-sse.service';
import { QueueService } from 'queue/queue.service';
import { SSEService } from 'sse/sse.service';

jest.mock('nestjs-redis');

describe('QueueChatService', () => {
  let service: QueueChatService;
  let redisMock: { [key: string]: jest.Mock };
  let conn: Connection;

  const mockRedisClient = () => ({
    get: jest.fn().mockResolvedValue('mocked_value'), // Simulates redis.get() returning a value
    set: jest.fn().mockResolvedValue('OK'), // Simulates redis.set() returning 'OK'
    del: jest.fn().mockResolvedValue(1), // Simulates redis.del() indicating 1 key deleted
    lpush: jest.fn().mockResolvedValue(1), // Simulates redis.lpush() returning new list length
    lrange: jest.fn().mockResolvedValue(['item1', 'item2']), // Simulates redis.lrange() returning list items
    expire: jest.fn().mockResolvedValue(1), // Simulates redis.expire() returning 1 (success)
    exists: jest.fn().mockResolvedValue(1), // Simulates redis.exists() returning 1 (key exists)
    llen: jest.fn().mockResolvedValue(2), // Simulates redis.llen() returning 2 (list length)
    keys: jest.fn().mockResolvedValue(['key1', 'key2']), // Simulates redis.keys() returning an array of keys
    pipeline: jest.fn().mockReturnValue({
      del: jest.fn().mockReturnThis(),
      unlink: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  });

  const staticDate = new Date('2023-01-01T00:00:00Z');

  beforeAll(async () => {
    redisMock = mockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        ApplicationTestingConfigModule,
        TypeOrmModule.forFeature([QueueChatsModel]),
      ],
      providers: [
        {
          provide: QueueService,
          useValue: {
            getQuestions: jest.fn().mockResolvedValue({
              questions: [],
            }),
            getQueue: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: QueueSSEService,
          useValue: {
            updateQueueChats: jest.fn(),
            sendToRoom: jest.fn(),
            subscribeClient: jest.fn(),
          },
        },
        QueueChatService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn(() => redisMock),
          },
        },
      ],
    }).compile();
    service = module.get<QueueChatService>(QueueChatService);
    conn = module.get<Connection>(Connection);
  });

  afterAll(async () => {
    await conn.close();
  });

  beforeEach(async () => {
    await conn.synchronize(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createChat', () => {
    it('should create a new chat in Redis', async () => {
      const staff = await UserFactory.create({ id: 1 });
      const question = await QuestionFactory.create({
        taHelped: staff,
      });

      const queueChatMetadata = await service.createChat(
        question.queueId,
        question.taHelped,
        question,
        staticDate,
      );

      const key_metadata = 'queue_chat_metadata:2:1:1';
      const key_messages = 'queue_chat_messages:2:1:1';
      expect(redisMock.del).toHaveBeenCalledWith(key_metadata);
      expect(redisMock.del).toHaveBeenCalledWith(key_messages);
      expect(redisMock.del).toHaveBeenCalledTimes(2);
      const expectedMetadata = {
        staff: {
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          photoURL: staff.photoURL,
        },
        student: {
          id: question.creator.id,
          firstName: question.creator.firstName,
          lastName: question.creator.lastName,
          photoURL: question.creator.photoURL,
        },
        startedAt: staticDate,
        questionId: question.id,
      };
      expect(redisMock.set).toHaveBeenCalledWith(
        key_metadata,
        JSON.stringify(expectedMetadata),
      );
      expect(redisMock.expire).toHaveBeenCalledWith(key_metadata, 86400); // 1 day in seconds
      expect(queueChatMetadata).toEqual(expectedMetadata);
    });
  });

  describe('sendMessage', () => {
    it('should store a chat message in Redis', async () => {
      await service.sendMessage(123, 2, 1, true, 'Hello!');

      const key = 'queue_chat_messages:123:2:1';
      expect(redisMock.lpush).toHaveBeenCalledWith(
        key,
        expect.stringMatching(/"isStaff":true,"message":"Hello!"/),
      );
    });
  });

  describe('getChatMetadata', () => {
    it('should return chat metadata from Redis', async () => {
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      const result = await service.getChatMetadata(123, 2, 1);
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2:1');
      expect(result).toEqual(metadata);
    });

    it('should return null if no metadata exists', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      const result = await service.getChatMetadata(123, 2, 1);
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2:1');
      expect(result).toBeNull();
    });
  });

  describe('getChatMessages', () => {
    it('should retrieve chat messages from Redis', async () => {
      const messages = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello!',
          timestamp: staticDate,
        }),
        JSON.stringify({
          isStaff: false,
          message: 'Hi!',
          timestamp: staticDate,
        }),
      ];

      redisMock.lrange.mockResolvedValueOnce(messages);

      const result = await service.getChatMessages(123, 2, 1);
      expect(redisMock.lrange).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
        0,
        -1,
      );

      expect(result).toEqual(
        messages
          .map((chatDataString) => {
            const message = JSON.parse(chatDataString);

            // Ensure the timestamp is a Date object
            message.timestamp = new Date(message.timestamp);

            return message;
          })
          .reverse(), // Ensure order is reversed as per the service logic
      );
    });

    it('should return null if no messages exist', async () => {
      redisMock.lrange.mockResolvedValueOnce([]);

      const result = await service.getChatMessages(123, 2, 1);
      expect(redisMock.lrange).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
        0,
        -1,
      );
      expect(result).toBeNull();
    });
  });

  describe('endChats', () => {
    it('should save chat data to the database and delete Redis keys', async () => {
      // Setup Redis mock for keys command to return one chat key
      redisMock.keys.mockResolvedValueOnce(['queue_chat_metadata:123:2:1']);

      // Setup metadata response
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      // Setup messages response
      const messages = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello!',
          timestamp: staticDate,
        }),
      ];
      redisMock.lrange.mockResolvedValueOnce(messages);

      // Mock QueueChatsModel constructor to capture created instances
      const savedModelData: any = {};
      const originalConstructor = QueueChatsModel.constructor;
      const originalSave = QueueChatsModel.prototype.save;

      // Create mock implementation for save
      QueueChatsModel.prototype.save = jest.fn(function () {
        // Capture properties from 'this'
        Object.assign(savedModelData, {
          queueId: this.queueId,
          staffId: this.staffId,
          studentId: this.studentId,
          startedAt: this.startedAt,
          messageCount: this.messageCount,
        });
        return Promise.resolve(this);
      });

      // Create a mock pipeline
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
      };
      redisMock.pipeline.mockReturnValueOnce(mockPipeline);

      // Call the service method
      await service.endChats(123, 2);

      // Restore original prototype method
      QueueChatsModel.prototype.save = originalSave;

      // Verify the model was saved with correct data
      expect(savedModelData.queueId).toBe(123);
      expect(savedModelData.staffId).toBe(1);
      expect(savedModelData.studentId).toBe(2);
      // startedAt might be a string or a Date - check both possibilities
      expect(
        savedModelData.startedAt instanceof Date ||
          typeof savedModelData.startedAt === 'string',
      ).toBe(true);
      expect(savedModelData.messageCount).toBe(1);

      // Verify that pipeline was used to delete Redis keys
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:1',
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should not save data if no messages exist', async () => {
      // Setup Redis mock for keys command to return one chat key
      redisMock.keys.mockResolvedValueOnce(['queue_chat_metadata:123:2:1']);

      // Setup metadata response
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      // Setup empty messages response
      redisMock.lrange.mockResolvedValueOnce([]);

      // Mock the QueueChatsModel save method to track if it was called
      const originalSave = QueueChatsModel.prototype.save;
      const saveMock = jest.fn().mockResolvedValue({});
      QueueChatsModel.prototype.save = saveMock;

      // Create a mock pipeline
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
      };
      redisMock.pipeline.mockReturnValueOnce(mockPipeline);

      // Call the service method
      await service.endChats(123, 2);

      // Restore original prototype method
      QueueChatsModel.prototype.save = originalSave;

      // Verify save was never called
      expect(saveMock).not.toHaveBeenCalled();

      // Verify that pipeline was still used to delete Redis keys
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:1',
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle multiple chats for a question', async () => {
      // Setup Redis mock for keys command to return multiple chat keys
      redisMock.keys.mockResolvedValueOnce([
        'queue_chat_metadata:123:2:1',
        'queue_chat_metadata:123:2:3',
      ]);

      // Setup metadata responses for first chat
      const metadata1 = {
        staff: { id: 1, firstName: 'Staff1', lastName: 'Last1' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata1));

      // Setup messages for first chat
      const messages1 = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello from TA 1!',
          timestamp: staticDate,
        }),
      ];
      redisMock.lrange.mockResolvedValueOnce(messages1);

      // Setup metadata responses for second chat
      const metadata2 = {
        staff: { id: 3, firstName: 'Staff2', lastName: 'Last2' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata2));

      // Setup messages for second chat
      const messages2 = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello from TA 2!',
          timestamp: staticDate,
        }),
      ];
      redisMock.lrange.mockResolvedValueOnce(messages2);

      // Create an array to capture saved model data
      const savedModelsData: any[] = [];

      // Create mock implementation for save
      const originalSave = QueueChatsModel.prototype.save;
      QueueChatsModel.prototype.save = jest.fn(function () {
        // Capture properties from 'this'
        savedModelsData.push({
          queueId: this.queueId,
          staffId: this.staffId,
          studentId: this.studentId,
        });
        return Promise.resolve(this);
      });

      // Create a mock pipeline
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
      };
      redisMock.pipeline.mockReturnValueOnce(mockPipeline);

      // Call the service method
      await service.endChats(123, 2);

      // Restore original prototype method
      QueueChatsModel.prototype.save = originalSave;

      // Verify that save was called twice
      expect(savedModelsData.length).toBe(2);

      // Verify the first saved chat had the correct properties
      expect(savedModelsData[0].queueId).toBe(123);
      expect(savedModelsData[0].staffId).toBe(1);
      expect(savedModelsData[0].studentId).toBe(2);

      // Verify the second saved chat had the correct properties
      expect(savedModelsData[1].queueId).toBe(123);
      expect(savedModelsData[1].staffId).toBe(3);
      expect(savedModelsData[1].studentId).toBe(2);

      // Verify pipeline was called to delete all Redis keys
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:1',
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:3',
      );
      expect(mockPipeline.del).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:3',
      );
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should handle errors from pipeline execution', async () => {
      // Setup Redis mock for keys command to return one chat key
      redisMock.keys.mockResolvedValueOnce(['queue_chat_metadata:123:2:1']);

      // Setup metadata response
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      // Setup messages response
      const messages = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello!',
          timestamp: staticDate,
        }),
      ];
      redisMock.lrange.mockResolvedValueOnce(messages);

      // Mock the QueueChatsModel save method
      const originalSave = QueueChatsModel.prototype.save;
      QueueChatsModel.prototype.save = jest.fn().mockResolvedValue({});

      // Mock the pipeline to throw an error
      const mockPipeline = {
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValueOnce(new Error('Redis error')),
      };
      redisMock.pipeline.mockReturnValueOnce(mockPipeline);

      // The service should throw an HttpException
      await expect(service.endChats(123, 2)).rejects.toThrow();

      // Restore original prototype method
      QueueChatsModel.prototype.save = originalSave;
    });
  });

  describe('clearChats', () => {
    it('should delete Redis keys without saving to database', async () => {
      // Setup Redis mock for keys commands
      redisMock.keys.mockResolvedValueOnce(['queue_chat_metadata:123:2:1']);
      redisMock.keys.mockResolvedValueOnce(['queue_chat_messages:123:2:1']);

      // Mock the pipeline
      const mockPipeline = {
        unlink: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce([]),
      };
      redisMock.pipeline.mockReturnValueOnce(mockPipeline);

      // Mock QueueSSEService updateQueueChats
      const queueSSEService = service['queueSSEService'] as any;
      jest
        .spyOn(queueSSEService, 'updateQueueChats')
        .mockResolvedValueOnce(undefined);

      // Call the service method
      await service.clearChats(123, 2);

      // Verify the keys calls
      expect(redisMock.keys).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:*',
      );
      expect(redisMock.keys).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:*',
      );

      // Verify pipeline was used for Redis operations
      expect(mockPipeline.unlink).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:1',
      );
      expect(mockPipeline.unlink).toHaveBeenCalledWith(
        'queue_chat_messages:123:2:1',
      );
      expect(mockPipeline.exec).toHaveBeenCalled();

      // Verify SSE service was called
      expect(queueSSEService.updateQueueChats).toHaveBeenCalledWith(123);
    });
  });

  describe('checkPermissions', () => {
    it('should return true if the user is a participant', async () => {
      const metadata = {
        staff: { id: 1 },
        student: { id: 2 },
      };

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      expect(await service.checkPermissions(123, 2, 1, 1)).toBe(true);

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      expect(await service.checkPermissions(123, 2, 1, 2)).toBe(true);
    });

    it('should return false if the user is not a participant', async () => {
      const metadata = {
        staff: { id: 5 },
        student: { id: 6 },
      };

      // Make sure Redis client returns exactly what we want for this specific test
      // Clear any previous mock implementations
      redisMock.get.mockReset();
      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      // User ID 1 is not among participants (staff ID 5 or student ID 6)
      const result = await service.checkPermissions(123, 2, 5, 1);

      // Verify the mock was called with the expected parameters
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2:5');
      expect(result).toBe(false);
    });

    it('should return false if no metadata exists', async () => {
      // Clear any previous mock implementations
      redisMock.get.mockReset();
      redisMock.get.mockResolvedValueOnce(null);

      const result = await service.checkPermissions(123, 2, 1, 1);

      // Verify the mock was called with the expected parameters
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2:1');
      expect(result).toBe(false);
    });
  });

  describe('checkChatExists', () => {
    it('should return true if a chat exists', async () => {
      redisMock.exists.mockResolvedValueOnce(1);

      expect(await service.checkChatExists(123, 2, 1)).toBe(true);
      expect(redisMock.exists).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2:1',
      );
    });

    it('should return false if a chat does not exist', async () => {
      redisMock.exists.mockResolvedValueOnce(0);

      expect(await service.checkChatExists(123, 2, 1)).toBe(false);
    });
  });
});
