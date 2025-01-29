import { Injectable, NotFoundException } from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import { Brackets, getRepository } from 'typeorm';
import { OrganizationCourseModel } from './organization-course.entity';
import { CourseModel } from 'course/course.entity';
import {
  CourseResponse,
  GetOrganizationUserResponse,
  LMSOrganizationIntegrationPartial,
  OrgUser,
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
  public async getOrganizationRoleByUserId(id: number): Promise<string> {
    const user = await UserModel.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      return null;
    }
    return user.organizationRole;
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

    return coursesSubset.map((course) => {
      return {
        courseId: course.courseid,
        courseName: course.coursename,
        isEnabled: course.isenabled,
      };
    });
  }

  public async getUsers(
    organizationId: number,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<OrgUser[]> {
    const organizationUsers = await getRepository(UserModel)
      .createQueryBuilder()
      .where('UserModel.organizationId = :organizationId', {
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
      'UserModel.organizationRole as userOrganizationRole',
    ]);

    const usersSubset = await users
      .orderBy('UserModel.lastName')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      // .getMany() wouldn't work here because relations are not working well with getMany()
      .getRawMany();

    return usersSubset.map((user) => {
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
  }

  public async getOrganizationUserByUserId(
    userId: number,
  ): Promise<GetOrganizationUserResponse> {
    const userResponse = await UserModel.findOne({
      where: {
        userId,
      },
      relations: ['courses', 'courses.course'],
    });

    if (!userResponse) {
      throw new NotFoundException(
        `OrganizationUser with userId ${userId} not found`,
      );
    }

    const { organizationId, organizationRole, userRole } = userResponse;

    const globalRole: string = userRole == UserRole.ADMIN ? 'unknown' : 'user';

    return {
      organizationId: organizationId,
      organizationRole: organizationRole,
      user: {
        id: userResponse.id,
        firstName: userResponse.firstName,
        lastName: userResponse.lastName,
        email: userResponse.email,
        photoUrl: userResponse.photoURL,
        fullName: userResponse.name,
        globalRole: globalRole,
        sid: userResponse.sid,
        accountDeactivated: userResponse.accountDeactivated,
      },
      courses: userResponse.courses.map((courseInfo) => {
        const { role, course } = courseInfo;

        return {
          id: course.id,
          name: course.name,
          role: role,
        };
      }),
    };
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
    id: number,
  ): Promise<FlattenedOrganizationResponse> {
    const user = await UserModel.findOne(
      {
        id,
      },
      {
        relations: ['organization'],
      },
    );

    if (!user) {
      return null;
    }

    return {
      id,
      orgId: user.organizationId,
      organizationName: user.organization.name,
      organizationDescription: user.organization.description,
      organizationLogoUrl: user.organization.logoUrl,
      organizationBannerUrl: user.organization.bannerUrl,
      organizationRole: user.organizationRole,
    };
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
