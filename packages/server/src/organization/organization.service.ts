import { Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationUserModel } from './organization-user.entity';
import { UserModel } from 'profile/user.entity';
import { Brackets } from 'typeorm';
import { OrganizationCourseModel } from './organization-course.entity';
import { CourseModel } from 'course/course.entity';
import {
  CourseResponse,
  ERROR_MESSAGES,
  GetOrganizationUserResponse,
  GetOrganizationUsersPaginatedResponse,
  OrganizationRole,
  OrganizationRoleHistoryFilter,
  OrganizationRoleHistoryResponse,
  OrgRoleChangeReason,
  OrgRoleChangeReasonMap,
  OrgRoleHistory,
  OrgUser,
  Role,
  UserRole,
} from '@koh/common';
import { UserCourseModel } from 'profile/user-course.entity';
import { SemesterModel } from 'semester/semester.entity';
import { OrganizationRoleHistory } from './organization_role_history.entity';
import { OrganizationSettingsModel } from './organization_settings.entity';
import { OrganizationModel } from './organization.entity';

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
      const numericSearch = search
        .match(/[0-9]*/g)
        .map((v) => parseInt(v))
        .filter((v) => !!v);
      organizationCourses.andWhere(
        new Brackets((q) => {
          q.where('UPPER("CourseModel"."name") like :searchString', {
            searchString: likeSearch,
          });
          if (numericSearch.length > 0) {
            q.orWhere('"CourseModel"."id" IN (:...numericSearch)', {
              numericSearch,
            });
          }
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
        'CourseModel.createdAt as createdAt',
        'SemesterModel.name as semesterName',
        'SemesterModel.color as semesterColor',
        'SemesterModel.startDate as semesterStartDate',
        'SemesterModel.endDate as semesterEndDate',
        'SemesterModel.description as semesterDescription',
        '(SELECT COUNT(*) FROM user_course_model WHERE user_course_model."courseId" = CourseModel.id AND user_course_model."role" = \'student\') as totalStudents',
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
        createdAt: course.createdat,
        totalStudents: course.totalstudents,
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
  ): Promise<GetOrganizationUsersPaginatedResponse> {
    const organizationUsers = OrganizationUserModel.createQueryBuilder(
      'orgUser',
    )
      .leftJoinAndSelect('orgUser.organizationUser', 'user')
      .where('orgUser.organizationId = :organizationId', {
        organizationId,
      });

    if (search) {
      organizationUsers.andWhere(`user.name ILIKE :search`, {
        search: `%${search}%`,
      });
    }

    organizationUsers
      .orderBy('user.lastName', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [entities, total] = await organizationUsers.getManyAndCount();

    const users: OrgUser[] = entities.map((orgUser) => ({
      userId: orgUser.organizationUser.id,
      firstName: orgUser.organizationUser.firstName,
      lastName: orgUser.organizationUser.lastName,
      email: orgUser.organizationUser.email,
      photoUrl: orgUser.organizationUser.photoURL ?? null,
      userRole: orgUser.organizationUser.userRole,
      organizationRole: orgUser.role,
    }));

    return { users, total };
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

  public async getRoleHistory(
    organizationId: number,
    page: number,
    pageSize: number,
    filters: OrganizationRoleHistoryFilter,
  ): Promise<OrganizationRoleHistoryResponse> {
    const { search, fromRole, toRole, minDate, maxDate } = filters;

    const organizationRoleHistory = OrganizationRoleHistory.createQueryBuilder()
      .select()
      .leftJoin(
        OrganizationUserModel,
        'ByOrganizationUser',
        'ByOrganizationUser.id = OrganizationRoleHistory.byOrgUserId',
      )
      .leftJoin(
        OrganizationUserModel,
        'ToOrganizationUser',
        'ToOrganizationUser.id = OrganizationRoleHistory.toOrgUserId',
      )
      .leftJoin(UserModel, 'ByUser', 'ByUser.id = ByOrganizationUser.userId')
      .leftJoin(UserModel, 'ToUser', 'ToUser.id = ToOrganizationUser.userId')
      .where('OrganizationRoleHistory.organizationId = :organizationId', {
        organizationId,
      });

    if (fromRole) {
      organizationRoleHistory.andWhere(
        'OrganizationRoleHistory.fromRole = :fromRole',
        { fromRole },
      );
    }

    if (toRole) {
      organizationRoleHistory.andWhere(
        'OrganizationRoleHistory.toRole = :toRole',
        { toRole },
      );
    }

    if (minDate) {
      organizationRoleHistory.andWhere(
        'OrganizationRoleHistory.timestamp > :minDate',
        { minDate },
      );
    }

    if (maxDate) {
      organizationRoleHistory.andWhere(
        'OrganizationRoleHistory.timestamp < :maxDate',
        { maxDate },
      );
    }

    if (search) {
      const likeSearch = `%${search.replace(' ', '')}%`.toUpperCase();
      organizationRoleHistory.andWhere(
        new Brackets((q) => {
          q.where('UPPER("ToUser".name) like :searchString', {
            searchString: likeSearch,
          });
        }),
      );
    }

    organizationRoleHistory.addSelect([
      'ToUser.id as toUserId',
      'ToUser.email as toUserEmail',
      'ToUser.firstName as toUserFirstName',
      'ToUser.lastName as toUserLastName',
      'ToUser.photoURL as toUserPhotoUrl',
      'ToUser.userRole as toUserRole',
      'ByUser.id as byUserId',
      'ByUser.email as byUserEmail',
      'ByUser.firstName as byUserFirstName',
      'ByUser.lastName as byUserLastName',
      'ByUser.photoURL as byUserPhotoUrl',
      'ByUser.userRole as byUserRole',
      'ByOrganizationUser.role as byUserCurrentRole',
      'ToOrganizationUser.role as toUserCurrentRole',
    ]);

    const historySubset = await organizationRoleHistory
      .orderBy('OrganizationRoleHistory.timestamp')
      .addOrderBy('OrganizationRoleHistory.id')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    return {
      totalHistory: await organizationRoleHistory.getCount(),
      history: historySubset.map((history) => {
        return {
          id: history.OrganizationRoleHistory_id,
          timestamp: history.OrganizationRoleHistory_timestamp,
          fromRole: history.OrganizationRoleHistory_fromRole,
          toRole: history.OrganizationRoleHistory_toRole,
          changeReason:
            OrgRoleChangeReasonMap[
              history.OrganizationRoleHistory_changeReason
            ],
          toUser: {
            userId: history.touserid,
            firstName: history.touserfirstname,
            lastName: history.touserlastname,
            email: history.touseremail,
            photoUrl: history.touserphotourl,
            userRole: history.touserrole,
            organizationRole: history.tousercurrentrole,
          },
          byUser: {
            userId: history.byuserid,
            firstName: history.byuserfirstname,
            lastName: history.byuserlastname,
            email: history.byuseremail,
            photoUrl: history.byuserphotoURL,
            userRole: history.byuserrole,
            organizationRole: history.byusercurrentrole,
          },
        } satisfies OrgRoleHistory;
      }),
    };
  }

  public async addRoleHistory(
    organizationId: number,
    fromRole: OrganizationRole,
    toRole: OrganizationRole,
    byOrgUserId?: number,
    toOrgUserId?: number,
    roleChangeReason: OrgRoleChangeReason = OrgRoleChangeReason.unknown,
  ) {
    await OrganizationRoleHistory.create({
      organizationId,
      // If someone appears to be changing their own role, it's the system changing their role (e.g., joining an organization)
      toOrgUserId: toOrgUserId == byOrgUserId ? null : toOrgUserId,
      byOrgUserId,
      fromRole,
      toRole,
      roleChangeReason,
    }).save();
  }

  public async getOrganizationSettings(organizationId: number) {
    let organizationSettings = await OrganizationSettingsModel.findOne({
      where: { organizationId },
    });
    // if no organization settings exist yet, create new course settings for the course
    if (!organizationSettings) {
      const organization = await OrganizationModel.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new NotFoundException(
          ERROR_MESSAGES.organizationService.cannotCreateOrgNotFound,
        );
      }

      organizationSettings =
        await OrganizationSettingsModel.create<OrganizationSettingsModel>({
          organizationId,
        } as Partial<OrganizationSettingsModel>).save();
    }

    return organizationSettings;
  }
}
