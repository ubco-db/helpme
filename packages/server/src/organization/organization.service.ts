import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationUserModel } from './organization-user.entity';
import { UserModel } from 'profile/user.entity';
import { Brackets, getRepository } from 'typeorm';
import { OrganizationCourseModel } from './organization-course.entity';
import { CourseModel } from 'course/course.entity';
import {
  CourseResponse,
  GetOrganizationUserResponse,
  OrgUser,
  LMSOrganizationIntegrationPartial,
  Role,
  UserRole,
} from '@koh/common';
import { UserCourseModel } from 'profile/user-course.entity';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';

export interface FlattenedOrganizationResponse {
  id: number;
  orgId: number;
  organizationName: string;
  organizationDescription: string;
  organizationLogoUrl: string;
  organizationBannerUrl: string;
  organizationRole: string;
}

export interface OrganizationCourseResponse {
  id: number;
  organizationId: number;
  courseId: number;
  course: CourseModel;
  profIds: Array<number>;
}

@Injectable()
export class OrganizationService {
  public async getOrganizationRoleByUserId(userId: number): Promise<string> {
    const organizationUser = await OrganizationUserModel.findOne({
      where: {
        userId,
      },
    });

    if (!organizationUser) {
      return null;
    }
    return organizationUser.role;
  }

  public async deleteUserCourses(
    userId: number,
    userCourses: number[],
  ): Promise<void> {
    const user = await UserModel.findOne({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }

    for (const courseId of userCourses) {
      const course = await CourseModel.findOne({
        where: {
          id: courseId,
        },
      });

      if (!course) {
        throw new NotFoundException(`Course with id ${courseId} not found`);
      }

      await UserCourseModel.delete({
        userId: user.id,
        courseId: course.id,
      });
    }
  }

  public async getCourses(
    organizationId: number,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<CourseResponse[]> {
    const organizationCourses = await getRepository(OrganizationCourseModel)
      .createQueryBuilder()
      .leftJoin(
        CourseModel,
        'CourseModel',
        'CourseModel.id = OrganizationCourseModel.courseId',
      )
      .where('OrganizationCourseModel.organizationId = :organizationId', {
        organizationId,
      });

    if (search) {
      const likeSearch = `%${search.replace(' ', '')}%`.toUpperCase();
      organizationCourses.andWhere(
        new Brackets((q) => {
          q.where('UPPER("CourseModel"."name") like :searchString', {
            searchString: likeSearch,
          });
        }),
      );
    }

    const courses = organizationCourses.select([
      'CourseModel.id as courseId',
      'CourseModel.name as courseName',
      'CourseModel.enabled as isEnabled',
    ]);

    const coursesSubset = await courses
      .orderBy('CourseModel.name')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      // .getMany() wouldn't work here because relations are not working well with getMany()
      .getRawMany();

    const coursesResponse = coursesSubset.map((course) => {
      return {
        courseId: course.courseid,
        courseName: course.coursename,
        isEnabled: course.isenabled,
      };
    });

    return coursesResponse;
  }

  public async getUsers(
    organizationId: number,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<OrgUser[]> {
    const organizationUsers = await getRepository(OrganizationUserModel)
      .createQueryBuilder()
      .leftJoin(
        UserModel,
        'UserModel',
        'UserModel.id = OrganizationUserModel.userId',
      )
      .where('OrganizationUserModel.organizationId = :organizationId', {
        organizationId,
      });

    if (search) {
      const likeSearch = `%${search.replace(' ', '')}%`.toUpperCase();
      organizationUsers.andWhere(
        new Brackets((q) => {
          q.where(
            'CONCAT(UPPER("UserModel"."firstName"), UPPER("UserModel"."lastName")) like :searchString',
            {
              searchString: likeSearch,
            },
          );
        }),
      );
    }

    const users = organizationUsers.select([
      'UserModel.id as userId',
      'UserModel.firstName as userFirstName',
      'UserModel.lastName as userLastName',
      'UserModel.email as userEmail',
      'UserModel.photoURL as userPhotoUrl',
      'UserModel.userRole as userRole',
      'OrganizationUserModel.role as userOrganizationRole',
    ]);

    const usersSubset = await users
      .orderBy('UserModel.lastName')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      // .getMany() wouldn't work here because relations are not working well with getMany()
      .getRawMany();

    const usersResponse = usersSubset.map((user) => {
      return {
        userId: user.userid,
        firstName: user.userfirstname,
        lastName: user.userlastname,
        email: user.useremail,
        photoUrl: user.userphotourl,
        userRole: user.userrole,
        organizationRole: user.userorganizationrole,
      };
    });

    return usersResponse;
  }

  public async getOrganizationUserByUserId(
    userId: number,
  ): Promise<GetOrganizationUserResponse> {
    const organizationUserResponse = await OrganizationUserModel.findOne({
      where: {
        userId,
      },
      relations: [
        'organizationUser',
        'organizationUser.courses',
        'organizationUser.courses.course',
      ],
    });

    if (!organizationUserResponse) {
      throw new NotFoundException(
        `OrganizationUser with userId ${userId} not found`,
      );
    }

    const { organizationId, role, organizationUser } = organizationUserResponse;

    const globalRole: string =
      organizationUser.userRole == UserRole.ADMIN ? 'unknown' : 'user';

    const flattenedUser = {
      organizationId: organizationId,
      organizationRole: role,
      user: {
        id: organizationUser.id,
        firstName: organizationUser.firstName,
        lastName: organizationUser.lastName,
        email: organizationUser.email,
        photoUrl: organizationUser.photoURL,
        fullName: organizationUser.name,
        globalRole: globalRole,
        sid: organizationUser.sid,
        accountDeactivated: organizationUser.accountDeactivated,
      },
      courses: organizationUser.courses.map((courseInfo) => {
        const { role, course } = courseInfo;

        return {
          id: course.id,
          name: course.name,
          role: role,
        };
      }),
    };

    return flattenedUser;
  }

  public async getOrganizationCourse(
    organizationId: number,
    courseId: number,
  ): Promise<OrganizationCourseResponse> {
    const organizationCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId,
        organizationId,
      },
      relations: ['course', 'course.semester'],
    });

    if (!organizationCourse) {
      throw new NotFoundException(
        `OrganizationCourse with organizationId ${organizationId} and courseId ${courseId} not found`,
      );
    }

    const professors = await UserCourseModel.find({
      where: {
        courseId,
        role: Role.PROFESSOR,
      },
    });

    let profIds = [];

    if (professors) {
      profIds = professors.map((professor) => professor.userId);
    }

    return {
      ...organizationCourse,
      profIds,
    };
  }

  public async getOrganizationAndRoleByUserId(
    userId: number,
  ): Promise<FlattenedOrganizationResponse> {
    const organizationUser = await OrganizationUserModel.createQueryBuilder(
      'organizationUser',
    )
      .leftJoinAndSelect('organizationUser.organization', 'organization')
      .where('organizationUser.userId = :userId', { userId })
      .getOne();

    if (!organizationUser) {
      return null;
    }

    const flattenedOrganization = {
      id: organizationUser.id,
      orgId: organizationUser.organization.id,
      organizationName: organizationUser.organization.name,
      organizationDescription: organizationUser.organization.description,
      organizationLogoUrl: organizationUser.organization.logoUrl,
      organizationBannerUrl: organizationUser.organization.bannerUrl,
      organizationRole: organizationUser.role,
    };

    return flattenedOrganization;
  }

  public async upsertLMSIntegration(
    organizationId: number,
    props: LMSOrganizationIntegrationPartial,
  ) {
    let integration = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: organizationId, apiPlatform: props.apiPlatform },
    });
    let isUpdate = false;
    if (integration) {
      integration.rootUrl = props.rootUrl;
      isUpdate = true;
    } else {
      integration = new LMSOrganizationIntegrationModel();
      integration.organizationId = organizationId;
      integration.apiPlatform = props.apiPlatform;
      integration.rootUrl = props.rootUrl;
    }
    await LMSOrganizationIntegrationModel.upsert(integration, [
      'organizationId',
      'apiPlatform',
    ]);
    return isUpdate
      ? `Successfully updated integration for ${integration.apiPlatform}`
      : `Successfully created integration for ${integration.apiPlatform}`;
  }
}
