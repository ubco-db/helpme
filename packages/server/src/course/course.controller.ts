import {
  CourseCloneAttributes,
  CourseSettingsRequestBody,
  CourseSettingsResponse,
  EditCourseInfoParams,
  ERROR_MESSAGES,
  GetCourseResponse,
  GetCourseUserInfoResponse,
  GetLimitedCourseResponse,
  Heatmap,
  OrganizationRole,
  QuestionStatusKeys,
  QueueConfig,
  QueueInvite,
  QueuePartial,
  QueueTypes,
  Role,
  TACheckinTimesResponse,
  TACheckoutResponse,
  UBCOuserParam,
  UserCourse,
  UserTiny,
  validateQueueConfigInput,
  SetTAExtraStatusParams,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UserCourseModel } from 'profile/user-course.entity';
import { Roles } from '../decorators/roles.decorator';
import { User, UserId } from '../decorators/user.decorator';
import { CourseRolesGuard } from '../guards/course-roles.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserModel } from '../profile/user.entity';
import { QueueModel } from '../queue/queue.entity';
import { CourseModel } from './course.entity';
import { QueueSSEService } from '../queue/queue-sse.service';
import { CourseService } from './course.service';
import { HeatmapService } from './heatmap.service';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { CourseSettingsModel } from './course_settings.entity';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { ConfigService } from '@nestjs/config';
import { ApplicationConfigService } from '../config/application_config.service';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { QueueCleanService } from 'queue/queue-clean/queue-clean.service';
import { CourseRole } from 'decorators/course-role.decorator';
import { OrgOrCourseRolesGuard } from 'guards/org-or-course-roles.guard';
import { CourseRoles } from 'decorators/course-roles.decorator';
import { OrgRoles } from 'decorators/org-roles.decorator';
import { OrganizationService } from '../organization/organization.service';
import { QueueStaffService } from 'queue/queue-staff/queue-staff.service';
import { DataSource } from 'typeorm';

@Controller('courses')
@UseInterceptors(ClassSerializerInterceptor)
export class CourseController {
  constructor(
    private configService: ConfigService,
    private queueSSEService: QueueSSEService,
    private heatmapService: HeatmapService,
    private courseService: CourseService,
    private queueStaffService: QueueStaffService,
    private queueCleanService: QueueCleanService,
    private organizationService: OrganizationService,
    private readonly appConfig: ApplicationConfigService,
    private dataSource: DataSource,
  ) {}

  @Get(':oid/organization_courses')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getOrganizationCourses(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<[]>> {
    const courses = await OrganizationCourseModel.find({
      where: {
        organizationId: oid,
      },
      take: 200,
      relations: ['course'],
    });

    if (!courses) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
    }

    const coursesPartial = courses.map((course) => ({
      id: course.course.id,
      name: course.course.name,
    }));

    res.status(HttpStatus.OK).send({
      coursesPartial,
    });
  }

  @Get('limited/:id/:code')
  async getLimitedCourseResponse(
    @Param('id', ParseIntPipe) id: number,
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<Response<GetLimitedCourseResponse>> {
    const courseWithOrganization = await CourseModel.findOne({
      where: {
        id: id,
        courseInviteCode: code,
      },
      relations: ['organizationCourse', 'organizationCourse.organization'],
    });

    if (
      !courseWithOrganization ||
      !courseWithOrganization.courseInviteCode ||
      courseWithOrganization.isCourseInviteEnabled === false
    ) {
      res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
      return;
    }

    const organization =
      courseWithOrganization.organizationCourse?.organization || null;

    const course_response = {
      id: courseWithOrganization.id,
      name: courseWithOrganization.name,
      organizationCourse: organization,
      courseInviteCode: courseWithOrganization.courseInviteCode,
    };

    res.status(HttpStatus.OK).send(course_response);
    return;
  }

  @Post('redirect_cookie/:id/:code')
  async setCourseInviteRedirectCookie(
    @Param('id', ParseIntPipe) id: number,
    @Param('code') code: string,
    @Res() res: Response,
  ): Promise<Response<GetLimitedCourseResponse>> {
    const courseWithOrganization = await CourseModel.findOne({
      where: {
        id: id,
        courseInviteCode: code,
      },
      relations: ['organizationCourse', 'organizationCourse.organization'],
    });

    if (
      !courseWithOrganization ||
      !courseWithOrganization.courseInviteCode ||
      courseWithOrganization.isCourseInviteEnabled === false
    ) {
      res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
      return;
    }

    const organization =
      courseWithOrganization.organizationCourse?.organization || null;

    res.cookie(
      '__SECURE_REDIRECT',
      `${id},${code}${organization ? `,${organization.id}` : ''}`,
      {
        httpOnly: true,
        secure: this.isSecure(),
      },
    );

    res.status(HttpStatus.OK).send({
      message: 'Course invite redirect cookie set',
    });
    return;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.STUDENT, Role.TA)
  async get(
    @Param('id', ParseIntPipe) id: number,
    @UserId() userId: number,
  ): Promise<GetCourseResponse> {
    // TODO: for all course endpoint, check if they're a student or a TA
    const course = await CourseModel.findOne({
      where: {
        id: id,
      },
      relations: {
        queues: {
          queueStaff: {
            user: true,
          },
        },
        organizationCourse: {
          organization: true,
        },
      },
    });
    if (course === null || course === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    course.queues = course.queues.filter((q) => !q.isDisabled);

    let queues: QueuePartial[] = [];
    try {
      queues = await Promise.all(
        course.queues.map(async (queue) => {
          await queue.addQueueSize(); // mutates queue
          return {
            ...queue,
            queueStaff:
              await this.queueStaffService.getFormattedStaffList(queue),
          };
        }),
      );
    } catch (err) {
      console.error(ERROR_MESSAGES.courseController.updatedQueueError, err);
      throw new InternalServerErrorException(
        ERROR_MESSAGES.courseController.updatedQueueError,
      );
    }

    let heatmap: Heatmap | false = false;
    try {
      // Use raw query for performance (avoid entity instantiation and serialization)
      heatmap = await this.heatmapService.getCachedHeatmapFor(id);
    } catch (err) {
      console.error(ERROR_MESSAGES.courseController.courseOfficeHourError, err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseHeatMapError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      ...course,
      queues,
      heatmap,
      organizationCourse: course.organizationCourse?.organization ?? null,
    };
  }

  @Patch(':id/edit_course')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async editCourseInfo(
    @Param('id', ParseIntPipe) courseId: number,
    @Body() coursePatch: EditCourseInfoParams,
  ): Promise<void> {
    await this.courseService.editCourse(courseId, coursePatch);
  }

  @Patch(':courseId/toggle_favourited')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async toggleFavourited(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<string> {
    try {
      const userCourse = await UserCourseModel.findOneOrFail({
        where: {
          courseId,
          userId,
        },
      });

      if (!userCourse)
        throw new NotFoundException('Your course enrollment is not found');

      userCourse.favourited = !userCourse.favourited;
      await userCourse.save();

      return 'Course favourited status updated successfully';
    } catch (err) {
      console.error(err);
      throw new BadRequestException(
        'Failed to toggle the favourite attribute if your course.',
      );
    }
  }

  @Post(':id/create_queue/:room')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async createQueue(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('room') room: string,
    @UserId() userId: number,
    @Body()
    body: {
      notes: string;
      type: QueueTypes;
      isProfessorQueue: boolean;
      config: QueueConfig;
    },
  ): Promise<QueueModel> {
    let newConfig: QueueConfig = {};
    if (body.config) {
      const configError = validateQueueConfigInput(body.config);
      if (configError) {
        throw new BadRequestException(configError);
      }
      newConfig = body.config;
    }

    const userCourseModel = await UserCourseModel.findOne({
      where: {
        userId: userId,
        courseId: courseId,
      },
    });

    if (userCourseModel === null || userCourseModel === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseModelError,
        HttpStatus.NOT_FOUND,
      );
    }

    const queue = await QueueModel.findOne({
      where: {
        room: room,
        courseId: courseId,
        isDisabled: false,
      },
    });

    if (queue) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueAlreadyExists,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (userCourseModel.role === Role.TA && body.isProfessorQueue) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.courseController.queueNotAuthorized,
      );
    }
    const queuesCount = await QueueModel.count({
      where: {
        courseId: courseId,
      },
    });

    if (queuesCount >= this.appConfig.get('max_queues_per_course')) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueLimitReached,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return this.courseService.createQueue(
        courseId,
        room,
        body.type ?? QueueTypes.Hybrid,
        body.notes,
        body.isProfessorQueue,
        newConfig,
      );
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.saveQueueError +
          '\nError message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.saveQueueError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // TODO: put this in transaction someday
  @Post(':id/checkin/:qid')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async checkMeIn(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('qid', ParseIntPipe) qid: number,
    @User() user: UserModel,
  ): Promise<QueuePartial> {
    const queue = await QueueModel.findOne({
      where: {
        id: qid,
        isDisabled: false,
      },
      relations: {
        queueStaff: {
          user: true,
        },
      },
    });
    if (!queue) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const userCourseModel = await UserCourseModel.findOne({
      where: {
        userId: user.id,
        courseId: courseId,
      },
    });

    if (!userCourseModel) {
      throw new HttpException(
        // shouldn't ever run since we use CourseRolesGuard but just in case
        ERROR_MESSAGES.courseController.courseModelError,
        HttpStatus.NOT_FOUND,
      );
    }

    if (userCourseModel.role === Role.TA && queue.isProfessorQueue) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.courseController.queueNotAuthorized,
      );
    }

    // If user was already in the queue...
    if (queue.queueStaff.some((staff) => staff.userId === user.id)) {
      throw new BadRequestException(`User already checked-in to ${queue.room}`);
    }

    const queueWasPreviouslyEmpty = queue.queueStaff.length === 0;
    if (queueWasPreviouslyEmpty) {
      queue.allowQuestions = true;
      await queue.save();
      this.queueCleanService.deleteAllLeaveQueueCronJobsForQueue(queue.id);
      await this.queueCleanService.resolvePromptStudentToLeaveQueueAlerts(
        queue.id,
      );
    }

    await this.queueStaffService.checkUserIn(user.id, queue.id, courseId);

    try {
      await this.queueSSEService.updateQueue(queue.id);
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.createEventError +
          '\nError message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.updatedQueueError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      ...queue,
      queueStaff: await this.queueStaffService.getFormattedStaffList(queue),
    };
  }

  @Delete(':id/checkout/:qid')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async checkMeOut(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('qid') qid: number,
    @User() user: UserModel,
  ): Promise<TACheckoutResponse> {
    const queue = await QueueModel.findOne({
      where: {
        id: qid,
        isDisabled: false,
      },
    });

    if (!queue) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await this.queueStaffService.checkUserOut(
        user.id,
        queue.id,
        courseId,
        manager,
      );
    });

    try {
      await this.queueSSEService.updateQueue(queue.id);
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.createEventError +
          '\nError message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.updatedQueueError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { queueId: queue.id };
  }

  /**
   * Allows a TA to set or clear their extra status (e.g., Away) for a specific queue.
   */
  @Patch(':id/ta_status/:qid')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async setTAExtraStatus(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('qid', ParseIntPipe) queueId: number,
    @User() user: UserModel,
    @Body() body: SetTAExtraStatusParams,
  ): Promise<void> {
    const queue = await QueueModel.findOne({
      where: {
        id: queueId,
        isDisabled: false,
      },
      relations: {
        queueStaff: true,
      },
    });

    if (!queue) {
      throw new NotFoundException(
        ERROR_MESSAGES.courseController.queueNotFound,
      );
    }

    // Only allow if the user is checked into this queue
    const isInStaffList = queue.queueStaff.some((s) => s.userId === user.id);
    if (!isInStaffList) {
      throw new BadRequestException('You must be checked in to set status');
    }

    await this.queueStaffService.setTAExtraStatusForQueue(
      queueId,
      courseId,
      user.id,
      body?.status ?? null,
    );

    await this.queueSSEService.updateQueue(queueId);
    return;
  }

  @Delete(':id/checkout_all')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async checkMeOutAll(
    @Param('id', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<void> {
    const allQueuesThatUserWasIn = await QueueModel.find({
      where: {
        courseId,
        isDisabled: false,
        queueStaff: {
          userId,
        },
      },
      relations: {
        queueStaff: true,
      },
    });

    await this.dataSource.transaction(async (manager) => {
      await this.queueStaffService.checkUserOutAll(userId, courseId, manager);
    });

    for (const queue of allQueuesThatUserWasIn) {
      try {
        await this.queueSSEService.updateQueue(queue.id);
      } catch (err) {
        console.error(
          ERROR_MESSAGES.courseController.createEventError +
            '\nError message: ' +
            err,
        );
        throw new HttpException(
          ERROR_MESSAGES.courseController.updatedQueueError,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Delete(':id/withdraw_course')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.PROFESSOR, Role.TA)
  async withdrawCourse(
    @Param('id', ParseIntPipe) courseId: number,
    @UserId() userId: number,
  ): Promise<void> {
    const userCourse = await UserCourseModel.findOne({
      where: { courseId, userId },
    });
    await this.courseService.removeUserFromCourse(userCourse);
  }

  @Get(':id/ta_check_in_times')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR)
  async taCheckinTimes(
    @Param('id', ParseIntPipe) courseId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<TACheckinTimesResponse> {
    try {
      return await this.courseService.getTACheckInCheckOutTimes(
        courseId,
        startDate,
        endDate,
      );
    } catch (err) {
      console.error(err);
      throw new HttpException(
        ERROR_MESSAGES.courseController.checkInTime,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/get_user_info/:page{/:role}')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR)
  async getUserInfo(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('page', ParseIntPipe) page: number,
    @Param('role') role?: Role | 'staff',
    @Query('search') search?: string,
  ): Promise<GetCourseUserInfoResponse> {
    const pageSize = role === 'staff' ? 100 : 50;
    if (!search) {
      search = '';
    }
    const roles = role === 'staff' ? [Role.TA, Role.PROFESSOR] : [role];
    return await this.courseService.getUserInfo(
      courseId,
      page,
      pageSize,
      search,
      roles,
    );
  }

  @Post('enroll_by_invite_code/:code')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async enrollCourseByInviteCode(
    @Param('code') code: string,
    @Body() body: UBCOuserParam,
    @Res() res: Response,
  ): Promise<Response<void>> {
    const user = await UserModel.findOne({
      where: {
        email: body.email,
        organizationUser: { organizationId: body.organizationId },
      },
      relations: ['organizationUser', 'courses'],
    });

    if (!user) {
      res.status(HttpStatus.NOT_FOUND).send({ message: 'User not found' });
      return;
    }

    const course = await OrganizationCourseModel.findOne({
      where: {
        organizationId: user.organizationUser.organizationId,
        courseId: body.selected_course,
      },
      relations: ['course'],
    });

    if (!course) {
      res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
      return;
    }

    if (
      !course.course.courseInviteCode ||
      course.course.isCourseInviteEnabled === false ||
      course.course.courseInviteCode !== code
    ) {
      res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.invalidInviteCode,
      });
      return;
    }

    await this.courseService
      .addStudentToCourse(course.course, user)
      .then(() => {
        res.clearCookie('__SECURE_REDIRECT', {
          httpOnly: true,
          secure: this.isSecure(),
        });
        res.status(HttpStatus.OK).send();
      })
      .catch((err) => {
        res.status(HttpStatus.BAD_REQUEST).send({ message: err.message });
      });

    return;
  }

  @Post(':id/add_student/:sid')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR)
  async addStudent(
    @Res() res: Response,
    @Req() req: Request,
    @Param('id', ParseIntPipe) courseId: number,
    @Param('sid', ParseIntPipe) studentId: number,
  ): Promise<Response<void>> {
    const user = await UserModel.findOne({
      where: { sid: studentId },
      relations: ['organizationUser', 'courses'],
    });

    const professorId: number = (req.user as { userId: number }).userId;
    const { organizationUser } = await UserModel.findOne({
      where: { id: professorId },
      relations: ['organizationUser'],
    });

    const organizationId = organizationUser.organizationId;

    if (!user) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'User with this student id is not found' });
      return;
    }

    if (user.id === professorId) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'You cannot add yourself to this course' });
      return;
    }

    if (user.organizationUser.organizationId !== organizationId) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: 'User is not in the same organization' });
      return;
    }

    const course = await CourseModel.findOne({
      where: {
        id: courseId,
      },
    });

    await this.courseService
      .addStudentToCourse(course, user)
      .then((resp) => {
        if (resp) {
          res
            .status(HttpStatus.OK)
            .send({ message: 'User is added to this course' });
        } else {
          res.status(HttpStatus.BAD_REQUEST).send({
            message:
              'User cannot be added to course. Please check if the user is already in the course',
          });
        }
      })
      .catch((err) => {
        res.status(HttpStatus.BAD_REQUEST).send({ message: err.message });
      });
    return;
  }

  @Patch(':id/update_user_role/:uid/:role')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR)
  async updateUserRole(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('uid', ParseIntPipe) userId: number,
    @Param('role') role: Role,
    @Res() res: Response,
  ): Promise<void> {
    const user = await UserCourseModel.findOne({
      where: {
        userId: userId,
        courseId: courseId,
      },
    });

    if (!user) {
      res.status(HttpStatus.NOT_FOUND).send({ message: 'User not found' });
      return;
    }

    try {
      await UserCourseModel.update({ courseId, userId }, { role });
    } catch (err) {
      res.status(HttpStatus.BAD_REQUEST).send({ message: err.message });
      return;
    }
    res.status(HttpStatus.OK).send({ message: 'Updated user course role' });
    return;
  }

  // UPDATE course_settings_model SET selectedFeature = false WHERE courseId = selectedCourseId;
  // will also create a new course settings record if it doesn't exist for the course
  @Patch(':id/features')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR)
  async enableDisableFeature(
    @Param('id', ParseIntPipe) courseId: number,
    @Body() body: CourseSettingsRequestBody,
  ): Promise<void> {
    // fetch existing course settings
    let courseSettings = await CourseSettingsModel.findOne({
      where: { courseId: courseId },
    });

    // if no course settings exist yet, create new course settings for the course
    if (!courseSettings) {
      // first make sure the course exists in course table (this check might not be needed as the guards already make sure the user is in the course (therefore the course must exist), but this is a rare function to be called so the small performance hit is acceptable for later safety)
      const course = await CourseModel.findOne({
        where: { id: courseId },
      });
      if (!course) {
        throw new NotFoundException(
          'Error while creating course settings: Course not found',
        );
      }
      courseSettings = new CourseSettingsModel(); // all features are enabled by default, adjust in CourseSettingsModel as needed
      courseSettings.courseId = courseId;
    }

    // then, toggle the requested feature
    try {
      courseSettings[body.feature] = body.value;
    } catch (err) {
      throw new BadRequestException('Invalid feature');
    }

    try {
      await courseSettings.save();
    } catch (err) {
      throw new HttpException(
        'Error while saving course settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // SELECT * FROM course_settings_model WHERE courseId = selectedCourseId;
  // if no settings for the courseid, return all true
  @Get(':id/features')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.STUDENT, Role.TA)
  async getFeatures(
    @Param('id', ParseIntPipe) courseId: number,
  ): Promise<CourseSettingsResponse> {
    const courseSettings = await CourseSettingsModel.findOne({
      where: { courseId },
    });

    // if no settings found for the courseid, return the default values
    const response = new CourseSettingsResponse({
      courseId: courseId,
      chatBotEnabled: courseSettings?.chatBotEnabled ?? true, // the 'true' at the end here is the default value
      asyncQueueEnabled: courseSettings?.asyncQueueEnabled ?? true,
      adsEnabled: courseSettings?.adsEnabled ?? true,
      queueEnabled: courseSettings?.queueEnabled ?? true,
      scheduleOnFrontPage: courseSettings?.scheduleOnFrontPage ?? false,
      asyncCentreAIAnswers: courseSettings?.asyncCentreAIAnswers ?? true,
      asyncCentreDefaultAnonymous:
        courseSettings?.asyncCentreDefaultAnonymous ?? true,
      asyncCentreAuthorPublic: courseSettings?.asyncCentreAuthorPublic ?? false,
      settingsFound: !!courseSettings, // !! converts truthy/falsy into true/false
    });

    return response;
  }

  @Get(':id/students_not_in_queue')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getAllStudentsNotInQueue(
    @Param('id', ParseIntPipe) courseId: number,
    @Query('with_a_task_question') withATaskQuestion: string,
    @Res() res: Response,
  ): Promise<UserTiny[]> {
    const withATaskQuestionBool = withATaskQuestion === 'true';

    // have to do a manual query 'cause the current version of typeORM we're using is crunked and creates syntax errors in postgres queries
    const query = `
    SELECT "user_model".name, "user_model".id AS id
    FROM "user_course_model"
    LEFT JOIN "user_model" ON ("user_course_model"."userId" = "user_model".id AND "user_course_model".role = $1)
    WHERE "user_course_model"."courseId" = $2 
      AND "user_model".id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "question_model"
        WHERE "question_model"."creatorId" = "user_model".id
        AND "question_model".status = $3
        AND "question_model"."isTaskQuestion" = $4
      )
    ORDER BY name;
  `;

    const studentsWithoutQuestions = await UserCourseModel.query(query, [
      Role.STUDENT,
      courseId,
      QuestionStatusKeys.Queued,
      withATaskQuestionBool,
    ]);

    res.status(200).send(studentsWithoutQuestions);
    return studentsWithoutQuestions;
  }

  private isSecure(): boolean {
    return this.configService.get<string>('DOMAIN').startsWith('https://');
  }

  @Get(':id/question_types')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getAllQuestionTypes(
    @Param('id', ParseIntPipe) courseId: number,
  ): Promise<QuestionTypeModel[]> {
    return QuestionTypeModel.find({ where: { cid: courseId } });
  }

  /**
   * Gets all queue's QueueInvites for the given course (+ the queue name)
   */
  @Get(':id/queue_invites')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async getQueueInvites(
    @Param('id', ParseIntPipe) courseId: number,
    @Res() res: Response,
  ): Promise<Response<QueueInvite>> {
    const query = `
    SELECT "queue_model".room AS room, "queue_invite_model".*
    FROM "queue_model"
    RIGHT JOIN "queue_invite_model" ON ("queue_model".id = "queue_invite_model"."queueId")
    WHERE "queue_model"."courseId" = $1
    ORDER BY room;
  `;

    const queueInvites = await QueueModel.query(query, [courseId]);

    res.status(200).send(queueInvites);
    return;
  }

  @Patch(':id/set_ta_notes/:uid')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async setTANotes(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('uid', ParseIntPipe) userId: number,
    @User() myUser: UserModel,
    @CourseRole() myRole: Role,
    @Body() body: { notes: string },
  ): Promise<void> {
    if (myRole === Role.TA && myUser.id !== userId) {
      throw new ForbiddenException('You can only set notes for yourself');
    }
    const userCourse = await UserCourseModel.findOne({
      where: { courseId, userId },
    });
    if (!userCourse) {
      throw new NotFoundException('TA not found');
    }
    userCourse.TANotes = body.notes;
    await userCourse.save();
  }

  @Post(':courseId/clone_course')
  @UseGuards(JwtAuthGuard, OrgOrCourseRolesGuard, EmailVerifiedGuard)
  @CourseRoles(Role.PROFESSOR)
  @OrgRoles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async cloneCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @User({ chat_token: true, organizationUser: true }) user: UserModel,
    @Body() body: CourseCloneAttributes,
  ): Promise<UserCourse | null> {
    const orgSettings = await this.organizationService.getOrganizationSettings(
      user.organizationUser?.organizationId,
    );
    if (
      !orgSettings.allowProfCourseCreate &&
      user.organizationUser?.role == OrganizationRole.PROFESSOR
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.organizationController.notAllowedToCreateCourse(
          user.organizationUser?.role,
        ),
      );
    }

    if (!user || !user.chat_token) {
      console.error(ERROR_MESSAGES.profileController.accountNotAvailable);
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountNotAvailable,
        HttpStatus.NOT_FOUND,
      );
    }

    const newUserCourse = await this.courseService.cloneCourse(
      courseId,
      user.id,
      body,
      user.chat_token.token,
    );

    return newUserCourse;
  }
}
