import {
  asyncQuestionStatus,
  CourseSettingsRequestBody,
  CourseSettingsResponse,
  EditCourseInfoParams,
  ERROR_MESSAGES,
  GetCourseResponse,
  GetCourseUserInfoResponse,
  GetLimitedCourseResponse,
  QuestionStatusKeys,
  QueueConfig,
  QueuePartial,
  Role,
  TACheckinTimesResponse,
  TACheckoutResponse,
  UBCOuserParam,
  UserTiny,
  validateQueueConfigInput,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import async from 'async';
import { Response, Request } from 'express';
import { EventModel, EventType } from 'profile/event-model.entity';
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
import { CourseSectionMappingModel } from 'login/course-section-mapping.entity';
import { AsyncQuestionModel } from 'asyncQuestion/asyncQuestion.entity';
import { OrganizationCourseModel } from 'organization/organization-course.entity';
import { CourseSettingsModel } from './course_settings.entity';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { ConfigService } from '@nestjs/config';
import { ApplicationConfigService } from '../config/application_config.service';
import { Not, getManager } from 'typeorm';
import { pick } from 'lodash';
import { QuestionTypeModel } from 'questionType/question-type.entity';
import { RedisQueueService } from '../redisQueue/redis-queue.service';

@Controller('courses')
@UseInterceptors(ClassSerializerInterceptor)
export class CourseController {
  constructor(
    private configService: ConfigService,
    private queueSSEService: QueueSSEService,
    private heatmapService: HeatmapService,
    private courseService: CourseService,
    private redisQueueService: RedisQueueService,
    private readonly appConfig: ApplicationConfigService,
  ) {}

  @Get(':oid/organization_courses')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getOrganizationCourses(
    @Res() res: Response,
    @Param('oid') oid: number,
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

  @Get(':cid/asyncQuestions')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getAsyncQuestions(
    @Param('cid') cid: number,
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<AsyncQuestionModel[]> {
    const userCourse = await UserCourseModel.findOne({
      where: {
        user,
        courseId: cid,
      },
    });

    if (!userCourse) {
      res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.profileController.userResponseNotFound,
      });
      return;
    }

    const asyncQuestionKeys = await this.redisQueueService.getKey(
      `c:${cid}:aq`,
    );
    let all: AsyncQuestionModel[] = [];

    if (Object.keys(asyncQuestionKeys).length === 0) {
      console.log('Fetching from Database');
      all = await AsyncQuestionModel.find({
        where: {
          courseId: cid,
          status: Not(asyncQuestionStatus.StudentDeleted),
        },
        relations: ['creator', 'taHelped', 'votes'],
        order: {
          createdAt: 'DESC',
        },
        take: this.appConfig.get('max_async_questions_per_course'),
      });

      if (all)
        await this.redisQueueService.setAsyncQuestions(`c:${cid}:aq`, all);
    } else {
      console.log('Fetching from Redis');
      all = Object.values(asyncQuestionKeys).map(
        (question) => question as AsyncQuestionModel,
      );
    }

    if (!all) {
      res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.questionController.notFound,
      });
      return;
    }

    let questions;

    const isStaff: boolean =
      userCourse.role === Role.TA || userCourse.role === Role.PROFESSOR;

    if (isStaff) {
      // Staff sees all questions except the ones deleted
      questions = all.filter(
        (question) => question.status !== asyncQuestionStatus.TADeleted,
      );
    } else {
      // Students see their own questions and questions that are visible
      questions = all.filter(
        (question) => question.creatorId === user.id || question.visible,
      );
    }

    questions = questions.map((question) => {
      const temp = pick(question, [
        'id',
        'courseId',
        'questionAbstract',
        'questionText',
        'aiAnswerText',
        'answerText',
        'creatorId',
        'taHelpedId',
        'createdAt',
        'closedAt',
        'status',
        'visible',
        'verified',
        'votes',
        'questionTypes',
        'votesSum',
        'isTaskQuestion',
      ]);

      Object.assign(temp, {
        creator:
          isStaff || question.creator.id == user.id
            ? {
                id: question.creator.id,
                name: question.creator.name,
                photoURL: question.creator.photoURL,
              }
            : null,
      });

      return temp;
    });

    res.status(HttpStatus.OK).send(questions);
    return;
  }

  @Get('limited/:id/:code')
  async getLimitedCourseResponse(
    @Param('id') id: number,
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

    if (!courseWithOrganization) {
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

    res.cookie(
      '__SECURE_REDIRECT',
      `${id},${code}${organization ? `,${organization.id}` : ''}`,
      {
        httpOnly: true,
        secure: this.isSecure(),
      },
    );

    res.status(HttpStatus.OK).send(course_response);
    return;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.STUDENT, Role.TA)
  async get(
    @Param('id') id: number,
    @User() user: UserModel,
  ): Promise<GetCourseResponse> {
    // TODO: for all course endpoint, check if they're a student or a TA
    const course = await CourseModel.findOne(id, {
      relations: ['queues', 'queues.staffList', 'organizationCourse'],
    });
    if (course === null || course === undefined) {
      console.error(
        ERROR_MESSAGES.courseController.courseNotFound + 'Course ID: ' + id,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // Use raw query for performance (avoid entity instantiation and serialization)

    try {
      course.heatmap = await this.heatmapService.getCachedHeatmapFor(id);
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.courseOfficeHourError +
          '\n' +
          'Error message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseHeatMapError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const userCourseModel = await UserCourseModel.findOne({
      where: {
        user,
        courseId: id,
      },
    });

    if (userCourseModel === undefined || userCourseModel === null) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseModelError,
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      userCourseModel.role === Role.PROFESSOR ||
      userCourseModel.role === Role.TA
    ) {
      course.queues = await async.filter(
        course.queues,
        async (q) => !q.isDisabled,
      );
    } else if (userCourseModel.role === Role.STUDENT) {
      course.queues = await async.filter(
        course.queues,
        async (q) => !q.isDisabled && (await q.checkIsOpen()),
      );
    }

    // make sure all of isopen is populated since we need it in FE
    for (const que of course.queues) {
      await que.checkIsOpen();
    }

    try {
      await async.each(course.queues, async (q) => {
        await q.addQueueSize();
      });
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.updatedQueueError +
          '\n' +
          'Error message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.updatedQueueError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const organizationCourse = await OrganizationCourseModel.findOne({
      where: {
        courseId: id,
      },
      relations: ['organization'],
    });

    const organization =
      organizationCourse === undefined ? null : organizationCourse.organization;

    const course_response = {
      ...course,
      crns: null,
      organizationCourse: organization,
    };
    try {
      course_response.crns = await CourseSectionMappingModel.find({ course });
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.courseOfficeHourError +
          '\n' +
          'Error message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseCrnsError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return course_response;
  }

  @Patch(':id/edit_course')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async editCourseInfo(
    @Param('id') courseId: number,
    @Body() coursePatch: EditCourseInfoParams,
  ): Promise<void> {
    await this.courseService.editCourse(courseId, coursePatch);
  }

  @Post(':id/ta_location/:room')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async checkIn(
    @Param('id') courseId: number,
    @Param('room') room: string,
    @User() user: UserModel,
  ): Promise<QueuePartial> {
    // First ensure user is not checked into another queue
    const queues = await QueueModel.find({
      where: {
        courseId: courseId,
      },
      relations: ['staffList'],
    });

    if (
      queues &&
      queues.some((q) => q.staffList.some((staff) => staff.id === user.id))
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.courseController.checkIn.cannotCheckIntoMultipleQueues,
      );
    }

    const queue = await QueueModel.findOne(
      {
        room,
        courseId,
        isDisabled: false,
      },
      { relations: ['staffList'] },
    );

    const userCourseModel = await UserCourseModel.findOne({
      where: {
        user,
        courseId,
      },
    });

    if (!queue) {
      if (userCourseModel === null || userCourseModel === undefined) {
        throw new HttpException(
          ERROR_MESSAGES.courseController.courseModelError,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        ERROR_MESSAGES.courseController.queueNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    if (userCourseModel.role === Role.TA && queue.isProfessorQueue) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.courseController.queueNotAuthorized,
      );
    }

    if (queue.staffList.length === 0) {
      queue.allowQuestions = true;
    }

    queue.staffList.push(user);
    try {
      await queue.save();
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

    try {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_CHECKED_IN,
        user,
        courseId,
        queueId: queue.id,
      }).save();
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.createEventError +
          '\nError message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.createEventError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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
    return queue;
  }

  @Post(':id/create_queue/:room')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async createQueue(
    @Param('id') courseId: number,
    @Param('room') room: string,
    @User() user: UserModel,
    @Body()
    body: {
      notes: string;
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
        user,
        courseId,
      },
    });

    if (userCourseModel === null || userCourseModel === undefined) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.courseModelError,
        HttpStatus.NOT_FOUND,
      );
    }

    const queue = await QueueModel.findOne({
      room,
      courseId,
      isDisabled: false,
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
      courseId,
    });

    if (queuesCount >= this.appConfig.get('max_queues_per_course')) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueLimitReached,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      let createdQueue = null;
      const entityManager = getManager();
      await entityManager.transaction(async (transactionalEntityManager) => {
        try {
          createdQueue = await transactionalEntityManager
            .create(QueueModel, {
              room,
              courseId,
              staffList: [],
              questions: [],
              allowQuestions: true,
              notes: body.notes,
              isProfessorQueue: body.isProfessorQueue,
              config: newConfig,
            })
            .save();

          // now for each tag defined in the config, create a QuestionType
          const questionTypes = newConfig.tags ?? {};
          for (const [tagKey, tagValue] of Object.entries(questionTypes)) {
            await transactionalEntityManager
              .getRepository(QuestionTypeModel)
              .insert({
                cid: courseId,
                name: tagValue.display_name,
                color: tagValue.color_hex,
                queueId: createdQueue.id,
              });
          }
        } catch (err) {
          throw err;
        }
      });

      return createdQueue;
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

  @Delete(':id/ta_location/:room')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR, Role.TA)
  async checkOut(
    @Param('id') courseId: number,
    @Param('room') room: string,
    @User() user: UserModel,
  ): Promise<TACheckoutResponse> {
    const queue = await QueueModel.findOne(
      {
        room,
        courseId,
        isDisabled: false,
      },
      { relations: ['staffList'] },
    );

    if (queue === undefined || queue === null) {
      throw new HttpException(
        ERROR_MESSAGES.courseController.queueNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    // Do nothing if user not already in stafflist
    if (!queue.staffList.find((e) => e.id === user.id)) return;

    queue.staffList = queue.staffList.filter((e) => e.id !== user.id);
    if (queue.staffList.length === 0) {
      queue.allowQuestions = false;
    }
    try {
      await queue.save();
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.saveQueueError +
          '\nError Message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.saveQueueError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      await EventModel.create({
        time: new Date(),
        eventType: EventType.TA_CHECKED_OUT,
        user,
        courseId,
        queueId: queue.id,
      }).save();
    } catch (err) {
      console.error(
        ERROR_MESSAGES.courseController.createEventError +
          '\nError message: ' +
          err,
      );
      throw new HttpException(
        ERROR_MESSAGES.courseController.createEventError,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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

  @Delete(':id/withdraw_course')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.STUDENT, Role.PROFESSOR, Role.TA)
  async withdrawCourse(
    @Param('id') courseId: number,
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
    @Param('id') courseId: number,
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

  @Get(':id/get_user_info/:page/:role?')
  @UseGuards(JwtAuthGuard, CourseRolesGuard, EmailVerifiedGuard)
  @Roles(Role.PROFESSOR)
  async getUserInfo(
    @Param('id') courseId: number,
    @Param('page') page: number,
    @Param('role') role?: Role,
    @Query('search') search?: string,
  ): Promise<GetCourseUserInfoResponse> {
    const pageSize = 50;
    if (!search) {
      search = '';
    }
    const users = await this.courseService.getUserInfo(
      courseId,
      page,
      pageSize,
      search,
      role,
    );
    return users;
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
      course.course.courseInviteCode === null ||
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
    @Param('id') courseId: number,
    @Param('sid') studentId: number,
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

    const course = await CourseModel.findOne({ id: courseId });

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
    @Param('id') courseId: number,
    @Param('uid') userId: number,
    @Param('role') role: Role,
    @Res() res: Response,
  ): Promise<void> {
    const user = await UserCourseModel.findOne({ userId, courseId });

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
    @Param('id') courseId: number,
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
    @Param('id') courseId: number,
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
      settingsFound: !!courseSettings, // !! converts truthy/falsy into true/false
    });

    return response;
  }

  @Get(':id/students_not_in_queue')
  @UseGuards(JwtAuthGuard, CourseRolesGuard)
  @Roles(Role.TA, Role.PROFESSOR)
  async getAllStudentsNotInQueue(
    @Param('id') courseId: number,
    @Res() res: Response,
  ): Promise<UserTiny[]> {
    // have to do a manual query 'cause the current version of typeORM we're using is crunked and creates syntax errors in postgres queries
    const query = `
    SELECT "user_model"."firstName" || ' ' || "user_model"."lastName" AS name, "user_model".id AS id
    FROM "user_course_model"
    LEFT JOIN "user_model" ON ("user_course_model"."userId" = "user_model".id AND "user_course_model".role = $1)
    WHERE "user_course_model"."courseId" = $2 AND "user_model".id IS NOT NULL
    AND NOT EXISTS (
    SELECT 1
    FROM "question_model"
    WHERE "question_model"."creatorId" = "user_model".id
    AND "question_model".status = $3
    )
    ORDER BY name;
  `;

    const studentsWithoutQuestions = await UserCourseModel.query(query, [
      Role.STUDENT,
      courseId,
      QuestionStatusKeys.Queued,
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
    @Param('id') courseId: number,
  ): Promise<QuestionTypeModel[]> {
    return QuestionTypeModel.find({ where: { cid: courseId } });
  }
}
