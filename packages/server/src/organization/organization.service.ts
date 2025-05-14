import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationUserModel } from './organization-user.entity';
import { UserModel } from 'profile/user.entity';
import { Brackets } from 'typeorm';
import { OrganizationCourseModel } from './organization-course.entity';
import { CourseModel } from 'course/course.entity';
import {
  CourseResponse,
  GetOrganizationUserResponse,
  OrgUser,
  Role,
  UserRole,
} from '@koh/common';
import { UserCourseModel } from 'profile/user-course.entity';
import { SemesterModel } from 'semester/semester.entity';

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
    const organizationCourses = OrganizationCourseModel.createQueryBuilder()
      .leftJoin(
        CourseModel,
        'CourseModel',
        'CourseModel.id = OrganizationCourseModel.courseId',
      )
      .leftJoin(
        SemesterModel,
        'SemesterModel',
        'SemesterModel.id = CourseModel.semesterId',
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

    const courses = organizationCourses
      .select([
        'CourseModel.id as courseId',
        'CourseModel.name as courseName',
        'CourseModel.enabled as isEnabled',
        'CourseModel.sectionGroupName as sectionGroupName',
        'CourseModel.semesterId as semesterId',
        'SemesterModel.name as semesterName',
        'SemesterModel.color as semesterColor',
        'SemesterModel.startDate as semesterStartDate',
        'SemesterModel.endDate as semesterEndDate',
        'SemesterModel.description as semesterDescription',
      ])
      // first order by semester end date, then by course name
      .orderBy('SemesterModel.endDate', 'DESC')
      .addOrderBy('CourseModel.name', 'ASC');

    let coursesSubset: any;

    if (page !== -1) {
      coursesSubset = await courses
        .skip((page - 1) * pageSize)
        .take(pageSize)
        // .getMany() wouldn't work here because relations are not working well with getMany()
        .getRawMany();
    } else {
      coursesSubset = await courses.getRawMany();
    }

    const coursesResponse: CourseResponse[] = coursesSubset.map((course) => {
      return {
        courseId: course.courseid,
        courseName: course.coursename,
        isEnabled: course.isenabled,
        sectionGroupName: course.sectiongroupname,
        semesterId: course.semesterid,
        semester: {
          id: course.semesterid,
          name: course.semestername,
          color: course.semestercolor,
          startDate: course.semesterstartdate,
          endDate: course.semesterenddate,
          description: course.semesterdescription,
        },
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
    const organizationUsers = OrganizationUserModel.createQueryBuilder()
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
          q.where('UPPER("UserModel".name) like :searchString', {
            searchString: likeSearch,
          });
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
}
