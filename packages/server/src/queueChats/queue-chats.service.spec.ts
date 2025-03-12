import { Test, TestingModule } from '@nestjs/testing';
import { QueueChatService } from './queue-chats.service';
import { QueueChatsModel } from './queue-chats.entity';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { ApplicationTestingConfigModule } from '../config/application_config.module';
import {
  initFactoriesFromService,
  QuestionFactory,
  UserFactory,
} from '../../test/util/factories';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

jest.mock('@liaoliaots/nestjs-redis');

const mockRedisClient = () => ({
  get: jest.fn().mockResolvedValue('mocked_value'), // Simulates redis.get() returning a value
  set: jest.fn().mockResolvedValue('OK'), // Simulates redis.set() returning 'OK'
  del: jest.fn().mockResolvedValue(1), // Simulates redis.del() indicating 1 key deleted
  lpush: jest.fn().mockResolvedValue(1), // Simulates redis.lpush() returning new list length
  lrange: jest.fn().mockResolvedValue(['item1', 'item2']), // Simulates redis.lrange() returning list items
  expire: jest.fn().mockResolvedValue(1), // Simulates redis.expire() returning 1 (success)
  exists: jest.fn().mockResolvedValue(1), // Simulates redis.exists() returning 1 (key exists)
});

describe('QueueChatService', () => {
  let service: QueueChatService;
  let redisMock: { [key: string]: jest.Mock };
  let dataSource: DataSource;

  const staticDate = new Date('2023-01-01T00:00:00Z');

  beforeAll(async () => {
    redisMock = mockRedisClient();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TestTypeOrmModule,
        TestConfigModule,
        ApplicationTestingConfigModule,
        TypeOrmModule.forFeature([QueueChatsModel]),
        FactoryModule,
      ],
      providers: [
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
    dataSource = module.get<DataSource>(DataSource);

    // Grab FactoriesService from Nest
    const factories = module.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.synchronize(true);
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

      await service.createChat(
        question.queueId,
        question.taHelped,
        question,
        staticDate,
      );

      const key_metadata = 'queue_chat_metadata:2:1';
      const key_messages = 'queue_chat_messages:2:1';
      expect(redisMock.del).toHaveBeenCalledWith(key_metadata);
      expect(redisMock.del).toHaveBeenCalledWith(key_messages);
      expect(redisMock.del).toHaveBeenCalledTimes(2);
      expect(redisMock.set).toHaveBeenCalledWith(
        key_metadata,
        JSON.stringify({
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
          startedAt: staticDate.toISOString(),
        }),
      );
      expect(redisMock.expire).toHaveBeenCalledWith(key_metadata, 604800); // one week in seconds
    });
  });

  describe('sendMessage', () => {
    it('should store a chat message in Redis', async () => {
      await service.sendMessage(123, 2, true, 'Hello!');

      const key = 'queue_chat_messages:123:2';
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

      const result = await service.getChatMetadata(123, 2);
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2');
      expect(result).toEqual(metadata);
    });

    it('should return null if no metadata exists', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      const result = await service.getChatMetadata(123, 2);
      expect(redisMock.get).toHaveBeenCalledWith('queue_chat_metadata:123:2');
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

      const result = await service.getChatMessages(123, 2);
      expect(redisMock.lrange).toHaveBeenCalledWith(
        'queue_chat_messages:123:2',
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

      const result = await service.getChatMessages(123, 2);
      expect(redisMock.lrange).toHaveBeenCalledWith(
        'queue_chat_messages:123:2',
        0,
        -1,
      );
      expect(result).toBeNull();
    });
  });

  describe('endChat', () => {
    it('should save chat data to the database and delete Redis keys', async () => {
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate.toISOString(),
      };

      const messages = [
        JSON.stringify({
          isStaff: true,
          message: 'Hello!',
          timestamp: staticDate,
        }),
      ];

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      redisMock.lrange.mockResolvedValueOnce(messages);

      const mockSave = jest
        .spyOn(QueueChatsModel.prototype, 'save')
        .mockResolvedValueOnce(undefined);

      await service.endChat(123, 2);

      expect(mockSave).toHaveBeenCalledWith();
      expect(redisMock.del).toHaveBeenCalledWith('queue_chat_metadata:123:2');
    });

    it('should not save data if no messages exist', async () => {
      const metadata = {
        staff: { id: 1, firstName: 'Staff', lastName: 'Last' },
        student: { id: 2, firstName: 'Student', lastName: 'Last' },
        startedAt: staticDate,
      };

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      redisMock.lrange.mockResolvedValueOnce([]);

      await service.endChat(123, 2);

      expect(
        QueueChatsModel.find({ where: { queueId: 123, studentId: 2 } }),
      ).resolves.toEqual([]);
      expect(redisMock.del).not.toHaveBeenCalledWith(
        'queue_chat_messages:123:2',
      );
    });
  });

  describe('checkPermissions', () => {
    it('should return true if the user is a participant', async () => {
      const metadata = {
        staff: { id: 1 },
        student: { id: 2 },
      };

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      expect(await service.checkPermissions(123, 2, 1)).toBe(true);

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));
      expect(await service.checkPermissions(123, 2, 2)).toBe(true);
    });

    it('should return false if the user is not a participant', async () => {
      const metadata = {
        staff: { id: 1 },
        student: { id: 2 },
      };

      redisMock.get.mockResolvedValueOnce(JSON.stringify(metadata));

      expect(await service.checkPermissions(123, 2, 3)).toBe(false);
    });

    it('should return false if no metadata exists', async () => {
      redisMock.get.mockResolvedValueOnce(null);

      expect(await service.checkPermissions(123, 2, 1)).toBe(false);
    });
  });

  describe('checkChatExists', () => {
    it('should return true if a chat exists', async () => {
      redisMock.exists.mockResolvedValueOnce(1);

      expect(await service.checkChatExists(123, 2)).toBe(true);
      expect(redisMock.exists).toHaveBeenCalledWith(
        'queue_chat_metadata:123:2',
      );
    });

    it('should return false if a chat does not exist', async () => {
      redisMock.exists.mockResolvedValueOnce(0);

      expect(await service.checkChatExists(123, 2)).toBe(false);
    });
  });
});
