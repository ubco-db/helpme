import { DataSource } from 'typeorm';
import { OrganizationService } from './organization.service';
import { Test, TestingModule } from '@nestjs/testing';
import { TestConfigModule, TestTypeOrmModule } from '../../test/util/testUtils';
import { OrganizationUserModel } from './organization-user.entity';
import {
  CourseFactory,
  initFactoriesFromService,
  OrganizationFactory,
  OrganizationSettingsFactory,
  UserFactory,
} from '../../test/util/factories';
import { ERROR_MESSAGES, UserRole } from '@koh/common';
import { OrganizationCourseModel } from './organization-course.entity';
import { UserCourseModel } from 'profile/user-course.entity';
import { FactoryModule } from 'factory/factory.module';
import { FactoryService } from 'factory/factory.service';
import { NotFoundException } from '@nestjs/common';
import { OrganizationSettingsModel } from './organization_settings.entity';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [TestTypeOrmModule, TestConfigModule, FactoryModule],
      providers: [OrganizationService],
    }).compile();
    service = module.get<OrganizationService>(OrganizationService);
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

  describe('getOrganizationAndRoleByUserId', () => {
    it('should return null if no organizationUser exists', async () => {
      const role = await service.getOrganizationAndRoleByUserId(0);
      expect(role).toBeNull();
    });

    it('should return the organization and role of the organizationUser', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const organizationUserModel =
        await service.getOrganizationAndRoleByUserId(user.id);
      expect(organizationUserModel).toMatchSnapshot();
    });
  });

  describe('deleteUserCourses', () => {
    it('should throw not found exception if user does not exist', async () => {
      await expect(
        service.deleteUserCourses(0, [1]),
      ).rejects.toThrowErrorMatchingSnapshot();
    });

    it('should delete user courses', async () => {
      const user = await UserFactory.create();
      const courseOne = await CourseFactory.create();
      const courseTwo = await CourseFactory.create();
      const organization = await OrganizationFactory.create();

      await UserCourseModel.create({
        userId: user.id,
        courseId: courseOne.id,
      }).save();

      await UserCourseModel.create({
        userId: user.id,
        courseId: courseTwo.id,
      }).save();

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: courseOne.id,
      }).save();

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: courseTwo.id,
      }).save();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: user.id,
      }).save();

      await service.deleteUserCourses(user.id, [courseOne.id, courseTwo.id]);

      const userCourses = await UserCourseModel.find({
        where: {
          userId: user.id,
        },
      });

      expect(userCourses).toHaveLength(0);
    });
  });

  describe('getCourses', () => {
    it('should return organization courses', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: course.id,
      }).save();

      const courses = await service.getCourses(organization.id, 1, 50);
      expect(courses).toMatchSnapshot({
        0: {
          semester: {
            startDate: expect.any(String),
            endDate: expect.any(String),
          },
        },
      } as any);
    });

    it('should not return organization courses if no courses match search query', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        name: 'test',
      });

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: course.id,
      }).save();

      const courses = await service.getCourses(
        organization.id,
        1,
        50,
        'notMatchingSearch',
      );
      expect(courses).toHaveLength(0);
    });

    it('should not return organization if no courses are available', async () => {
      const organization = await OrganizationFactory.create();
      const courses = await service.getCourses(organization.id, 1, 50);
      expect(courses).toHaveLength(0);
    });

    it('should return organization courses with search', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create({
        name: 'test',
      });

      const courseTwo = await CourseFactory.create({
        name: 'courseNotMatchingSearch',
      });

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: course.id,
      }).save();

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: courseTwo.id,
      }).save();

      const courses = await service.getCourses(organization.id, 1, 50, 'test');
      expect(courses).toMatchSnapshot({
        0: {
          semester: {
            startDate: expect.any(String),
            endDate: expect.any(String),
          },
        },
      } as any);
    });
  });

  describe('getUsers', () => {
    it('should return empty organization users if no users are available', async () => {
      const organization = await OrganizationFactory.create();
      const result = await service.getUsers(organization.id, 1, 50);
      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return empty organization users if no users match search query', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserFactory.create({
        firstName: 'test',
      });

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: user.id,
      }).save();

      const result = await service.getUsers(
        organization.id,
        1,
        50,
        'notMatchingSearch',
      );

      expect(result.users).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return organization users with search', async () => {
      const organization = await OrganizationFactory.create();
      const user = await UserFactory.create({
        firstName: 'test',
      });

      const userTwo = await UserFactory.create({
        firstName: 'userNotMatchingSearch',
      });

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: user.id,
      }).save();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: userTwo.id,
      }).save();

      const result = await service.getUsers(organization.id, 1, 50, 'test');
      expect(result.users).toMatchSnapshot();
      expect(result.total).toBe(1);
    });

    it('should return organization users', async () => {
      const organization = await OrganizationFactory.create();
      const userOne = await UserFactory.create();
      const userTwo = await UserFactory.create();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: userOne.id,
      }).save();

      await OrganizationUserModel.create({
        organizationId: organization.id,
        userId: userTwo.id,
      }).save();

      const result = await service.getUsers(organization.id, 1, 50);
      expect(result.users).toMatchSnapshot();
      expect(result.total).toBe(2);
    });
  });

  describe('getOrganizationUserByUserId', () => {
    it("should throw not found exception if user doesn' exist", async () => {
      await expect(
        service.getOrganizationUserByUserId(0),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"OrganizationUser with userId 0 not found"`,
      );
    });

    it('should return organizationUser globalRole as unknown when user global role is admin', async () => {
      const user = await UserFactory.create({
        userRole: UserRole.ADMIN,
      });
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const organizationUser = await service.getOrganizationUserByUserId(
        user.id,
      );
      expect(organizationUser).toMatchSnapshot();
    });

    it('should return the organizationUser', async () => {
      const user = await UserFactory.create();
      const organization = await OrganizationFactory.create();

      await OrganizationUserModel.create({
        userId: user.id,
        organizationId: organization.id,
      }).save();

      const organizationUser = await service.getOrganizationUserByUserId(
        user.id,
      );
      expect(organizationUser).toMatchSnapshot();
    });
  });

  describe('getOrganizationCourse', () => {
    it('should throw not found exception if organization course does not exist', async () => {
      await expect(
        service.getOrganizationCourse(0, 0),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"OrganizationCourse with organizationId 0 and courseId 0 not found"`,
      );
    });

    it('should return organization course', async () => {
      const organization = await OrganizationFactory.create();
      const course = await CourseFactory.create();

      await OrganizationCourseModel.create({
        organizationId: organization.id,
        courseId: course.id,
      }).save();

      const organizationCourse = await service.getOrganizationCourse(
        organization.id,
        course.id,
      );
      expect(organizationCourse).toMatchSnapshot({
        createdAt: expect.any(Date),
        course: {
          createdAt: expect.any(Date),
          semester: {
            createdAt: expect.any(Date),
            startDate: expect.any(Date),
            endDate: expect.any(Date),
          },
        },
      } as any);
    });
  });

  describe('getOrganizationSettings', () => {
    it('should fail with not found if organization not found', async () => {
      await expect(service.getOrganizationSettings(-1)).rejects.toThrow(
        new NotFoundException(
          ERROR_MESSAGES.organizationService.cannotCreateOrgNotFound,
        ),
      );
    });

    it("should create a new organization settings with defaults if it doesn't exist", async () => {
      const organization = await OrganizationFactory.create();
      const createSpy = jest.spyOn(OrganizationSettingsModel, 'create');
      const saveSpy = jest.spyOn(OrganizationSettingsModel.prototype, 'save');

      const settings = await service.getOrganizationSettings(organization.id);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith({
        organizationId: organization.id,
      });
      expect(saveSpy).toHaveBeenCalledTimes(1);

      expect(settings).toHaveProperty('organizationId', organization.id);
      expect(settings).toHaveProperty('allowProfCourseCreate', true);

      createSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('should return existing organization settings if found', async () => {
      const organization = await OrganizationFactory.create();
      const organizationSettings = await OrganizationSettingsFactory.create({
        organizationId: organization.id,
        organization,
        allowProfCourseCreate: false,
      });
      const createSpy = jest.spyOn(OrganizationSettingsModel, 'create');
      const saveSpy = jest.spyOn(OrganizationSettingsModel.prototype, 'save');

      const settings = await service.getOrganizationSettings(organization.id);
      expect(createSpy).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
      expect(settings).toHaveProperty('organizationId', organization.id);
      expect(settings).toHaveProperty(
        'allowProfCourseCreate',
        organizationSettings.allowProfCourseCreate,
      );

      createSpy.mockRestore();
      saveSpy.mockRestore();
    });
  });
});
