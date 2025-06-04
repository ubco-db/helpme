import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { OrganizationService } from '../organization/organization.service';
import {
  initFactoriesFromService,
  UserFactory,
} from '../../test/util/factories';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import checkDiskSpace from 'check-disk-space';
import sharp from 'sharp';
import * as fs from 'fs';
import { AccountType } from '@koh/common';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import * as path from 'path';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';

jest.mock('check-disk-space', () => ({ __esModule: true, default: jest.fn() }));
const mockedCheckDiskSpace = checkDiskSpace as jest.MockedFunction<
  typeof checkDiskSpace
>;

jest.spyOn(fs, 'existsSync').mockReturnValue(true);
jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);

jest.mock('sharp', () => {
  const mockSharpInstance = {
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue(undefined),
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockSharpInstance),
  };
});
const mockedSharp = sharp as jest.MockedFunction<typeof sharp>;

describe('ProfileService', () => {
  let service: ProfileService;
  let redisProfileService: RedisProfileService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
      providers: [
        ProfileService,
        {
          provide: RedisProfileService,
          useValue: { deleteProfile: jest.fn() },
        },
        {
          provide: OrganizationService,
          useValue: { getOrganizationAndRoleByUserId: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get<ProfileService>(ProfileService);
    redisProfileService =
      moduleRef.get<RedisProfileService>(RedisProfileService);

    // Grab FactoriesService from Nest
    const factories = moduleRef.get<FactoryService>(FactoryService);
    // Initialize the named exports to point to the actual factories
    initFactoriesFromService(factories);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadUserProfileImage', () => {
    const mockFile = {
      buffer: Buffer.from('test-image'),
    } as Express.Multer.File;

    it('should upload and save user profile image', async () => {
      const user = await UserFactory.create();
      process.env.UPLOAD_LOCATION = '/uploads';

      mockedCheckDiskSpace.mockResolvedValue({
        size: 5_000_000_000,
        free: 2_000_000_000,
      });

      const fileName = await service.uploadUserProfileImage(mockFile, user);

      expect(fileName).toMatch(new RegExp(`^${user.id}-\\d+\\.webp$`));
      expect(mockedSharp).toHaveBeenCalledWith(mockFile.buffer);
    });

    it('should throw if disk space is insufficient', async () => {
      mockedCheckDiskSpace.mockResolvedValue({
        size: 5_000_000_000,
        free: 500_000,
      });

      const user = await UserFactory.create();
      await expect(
        service.uploadUserProfileImage(mockFile, user),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('removeProfilePicture', () => {
    it('should remove the profile picture if it exists locally', async () => {
      const user = await UserFactory.create({ photoURL: 'test-image.webp' });
      process.env.UPLOAD_LOCATION = '/uploads';

      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);

      await service.removeProfilePicture(user);

      expect(unlinkSpy).toHaveBeenCalledWith(
        path.join('/', 'uploads', 'test-image.webp'),
      );
    });

    it('should handle removing an external profile picture URL', async () => {
      const user = await UserFactory.create({
        photoURL: 'http://external.com/image.jpg',
      });

      await service.removeProfilePicture(user);

      expect(user.photoURL).toBeNull();
    });

    it('should throw if the profile picture does not exist', async () => {
      const user = await UserFactory.create({ photoURL: null });
      process.env.UPLOAD_LOCATION = '/uploads';

      await expect(service.removeProfilePicture(user)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile details', async () => {
      const user = await UserFactory.create({ email: 'test@ubc.ca' });
      const updatedData = { firstName: 'Updated', lastName: 'User' };

      await service.updateUserProfile(user, updatedData);

      expect(user.firstName).toBe('Updated');
      expect(user.lastName).toBe('User');
    });

    it('should throw error when updating email for non-legacy account', async () => {
      const user = await UserFactory.create({
        accountType: AccountType.GOOGLE,
        email: 'test@ubc.ca',
      });

      await expect(
        service.updateUserProfile(user, { email: 'newemail@ubc.ca' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
