import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import { Response } from 'express';
import {
  COURSE_TIMEZONES,
  CoursePartial,
  CourseResponse,
  CourseSettingsRequestBody,
  ERROR_MESSAGES,
  GetOrganizationUserResponse,
  LMSCourseIntegrationPartial,
  LMSIntegration,
  LMSOrganizationIntegrationPartial,
  OrganizationProfessor,
  OrganizationResponse,
  OrganizationRole,
  OrgUser,
  Role,
  UpdateOrganizationCourseDetailsParams,
  UpdateOrganizationDetailsParams,
  UpdateOrganizationUserRole,
  UpdateProfileParams,
  UserRole,
} from '@koh/common';
import * as fs from 'fs';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { OrganizationRolesGuard } from 'guards/organization-roles.guard';
import { CourseModel } from 'course/course.entity';
import { OrganizationCourseModel } from './organization-course.entity';
import { OrganizationModel } from './organization.entity';
import { Roles } from 'decorators/roles.decorator';
import {
  OrganizationCourseResponse,
  OrganizationService,
} from './organization.service';
import { OrganizationGuard } from 'guards/organization.guard';
import * as checkDiskSpace from 'check-disk-space';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SemesterModel } from 'semester/semester.entity';
import { getManager, In } from 'typeorm';
import { UserCourseModel } from 'profile/user-course.entity';
import { CourseSettingsModel } from 'course/course_settings.entity';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { ChatTokenModel } from 'chatbot/chat-token.entity';
import { v4 } from 'uuid';
import * as sharp from 'sharp';
import { UserId } from 'decorators/user.decorator';
import { LMSOrganizationIntegrationModel } from '../lmsIntegration/lmsOrgIntegration.entity';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

@Controller('organization')
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  @Post(':oid/reset_chat_token_limit')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async resetChatTokenLimit(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<void>> {
    // Reset chat token limit for the organization
    await ChatTokenModel.query(
      `
      UPDATE public.chat_token_model
      SET used = 0, 
          max_uses = CASE
            WHEN EXISTS (
              SELECT 1 
              FROM user_model
              WHERE user_model."id" = public.chat_token_model.user
                AND user_model."organizationRole" != 'member'
                AND user_model."organizationId" = $1
            ) THEN 300
            ELSE 30
          END 
      WHERE public.chat_token_model.user IN (
        SELECT "id"
        FROM user_model
        WHERE "organizationId" = $1
      )
    `,
      [oid],
    );

    return res.sendStatus(200);
  }

  /**
   * Gets all cron jobs for the system. The :oid is just to verify that they are an admin
   */
  @Get(':oid/cronjobs')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getAllCronJobs(
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<any[] | CronJob[]> {
    const jobs = this.schedulerRegistry.getCronJobs();
    const jobsArray = Array.from(jobs.entries()).map(([key, job]) => {
      const nextDates = job.running ? job.nextDates(10) : [];
      return {
        id: key,
        cronTime: job.cronTime.source,
        running: job.running,
        nextDates: nextDates,
        lastExecution: job.lastExecution,
        runOnce: job.runOnce,
      };
    });
    return jobsArray;
  }

  @Post(':oid/populate_subscription_table')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async populateSubscriptionTable(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<void>> {
    try {
      const entityManager = getManager();

      // Get all users for the organization with their highest role
      const orgUsers = await entityManager.query(
        `
          SELECT u."id",
                 CASE
                   WHEN EXISTS (
                     SELECT 1 
                     FROM user_course_model uc 
                     WHERE uc."userId" = u."id" AND uc.role != 'student'
                   ) THEN 'professor'
                   ELSE u."organizationRole"
                 END AS role
          FROM user_model u
          WHERE u."organizationId" = $1
        `,
        [oid],
      );

      // Get all mail services
      const mailServices = await entityManager.query(`
        SELECT id, "mailType", "serviceType"
        FROM mail_services
      `);

      // Prepare arrays for bulk insert
      const subscriptionsToInsert = [];

      for (const user of orgUsers) {
        for (const service of mailServices) {
          let shouldSubscribe = true;
          let isEnabled = true;

          if (
            user.role === 'member' &&
            !['ta', 'professor'].includes(user.role)
          ) {
            // Members who are not TAs or professors only subscribe to member services
            shouldSubscribe = service.mailType === 'member';
          } else {
            // Admins, TAs, and professors subscribe to all, but member services are disabled
            isEnabled = service.mailType !== 'member';
          }

          if (shouldSubscribe) {
            subscriptionsToInsert.push([user.userId, service.id, isEnabled]);
          }
        }
      }

      // Bulk insert subscriptions
      if (subscriptionsToInsert.length > 0) {
        await entityManager.query(
          `
          INSERT INTO user_subscriptions ("userId", "serviceId", "isSubscribed")
          SELECT u, s, e
          FROM unnest($1::int[], $2::int[], $3::boolean[]) AS t(u, s, e)
          WHERE NOT EXISTS (
            SELECT 1 
            FROM user_subscriptions us
            WHERE us."userId" = t.u AND us."serviceId" = t.s
          )
        `,
          [
            subscriptionsToInsert.map((s) => s[0]),
            subscriptionsToInsert.map((s) => s[1]),
            subscriptionsToInsert.map((s) => s[2]),
          ],
        );
      }

      return res.status(HttpStatus.OK).send({
        message: 'Subscription table populated',
      });
    } catch (error) {
      console.error('Error populating subscription table:', error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: 'Error populating subscription table',
        error: error.message,
      });
    }
  }

  @Post(':oid/populate_chat_token_table')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async populateChatTokenTable(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<void>> {
    const users = await UserModel.find({
      where: {
        organizationId: oid,
      },
      relations: ['chat_token'],
    });

    let chatTokenCount = 0;
    for (const user of users) {
      if (!user.chat_token) {
        await ChatTokenModel.create({
          user: user,
          token: v4(),
        }).save();
      } else {
        chatTokenCount += 1;
      }
    }

    if (chatTokenCount === users.length) {
      return res.status(HttpStatus.OK).send({
        message: 'Chat token table already populated',
      });
    }

    return res.status(HttpStatus.OK).send({
      message: 'Chat token table populated',
    });
  }

  @Post(':oid/create_course')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async createCourse(
    @Param('oid', ParseIntPipe) oid: number,
    @Body() courseDetails: UpdateOrganizationCourseDetailsParams,
    @Res() res: Response,
  ): Promise<Response<void>> {
    if (!courseDetails.name || courseDetails.name.trim().length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.courseNameTooShort,
      });
    }

    if (
      courseDetails.coordinator_email &&
      courseDetails.coordinator_email.trim().length < 1
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.coordinatorEmailTooShort,
      });
    }

    if (
      courseDetails.sectionGroupName &&
      courseDetails.sectionGroupName.trim().length < 1
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.sectionGroupNameTooShort,
      });
    }

    if (
      !courseDetails.timezone ||
      !COURSE_TIMEZONES.find((timezone) => timezone === courseDetails.timezone)
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: `Timezone field is invalid, must be one of ${COURSE_TIMEZONES.join(
          ', ',
        )}`,
      });
    }

    if (
      !courseDetails.semesterName &&
      courseDetails.semesterName.trim().length < 2
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterNameTooShort,
      });
    }

    const semesterDetails = courseDetails.semesterName.split(',');

    if (semesterDetails.length !== 2) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterNameFormat,
      });
    }

    if (isNaN(parseInt(semesterDetails[1]))) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterYearInvalid,
      });
    }

    const course = {
      name: courseDetails.name,
      coordinator_email: courseDetails.coordinator_email,
      sectionGroupName: courseDetails.sectionGroupName,
      zoomLink: courseDetails.zoomLink,
      timezone: courseDetails.timezone,
      enabled: true,
    };
    try {
      const newCourse = await CourseModel.create(course).save();

      if (courseDetails.profIds)
        for (const profId of courseDetails.profIds) {
          const chosenProfessor = await UserModel.findOne({
            where: { id: profId },
          });

          if (!chosenProfessor) {
            return res.status(HttpStatus.NOT_FOUND).send({
              message: `Professor with ID ${profId} not found`,
            });
          }

          await UserCourseModel.create({
            userId: profId,
            course: newCourse,
            role: Role.PROFESSOR,
            expires: false,
          }).save();
        }

      await OrganizationCourseModel.create({
        organizationId: oid,
        course: newCourse,
      }).save();

      const semester = await SemesterModel.findOne({
        where: {
          season: semesterDetails[0],
          year: parseInt(semesterDetails[1]),
        },
        relations: ['courses'],
      });

      if (!semester) {
        await SemesterModel.create({
          season: semesterDetails[0],
          year: parseInt(semesterDetails[1]),
          courses: [newCourse],
        }).save();
      } else {
        semester.courses.push(newCourse);
        await semester.save();
      }

      // create courseSettingsModel for the new course (all checks are performed by typescript)
      const newCourseSettings = new CourseSettingsModel();
      newCourseSettings.courseId = newCourse.id;
      // for each feature given, assign its corresponding values
      if (courseDetails.courseSettings) {
        for (const givenFeature of courseDetails.courseSettings) {
          if (!CourseSettingsRequestBody.isValidFeature(givenFeature.feature)) {
            return res.status(HttpStatus.BAD_REQUEST).send({
              message: 'invalid feature: ' + givenFeature.feature,
            });
          }
          newCourseSettings[givenFeature.feature] = givenFeature.value;
        }
      }
      await newCourseSettings.save();

      let message = 'Course created successfully.';
      let status = HttpStatus.OK;
      if (!courseDetails.courseSettings) {
        message += ' Default settings used.';
        status = HttpStatus.ACCEPTED;
      }
      if (!courseDetails.profIds) {
        message += ' No professors given.';
        status = HttpStatus.ACCEPTED;
      }

      return res.status(status).send({
        message: message,
      });
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: err,
      });
    }
  }

  @Patch(':oid/update_course/:cid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async updateCourse(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() courseDetails: UpdateOrganizationCourseDetailsParams,
  ): Promise<Response<void>> {
    const courseInfo = await OrganizationCourseModel.findOne({
      where: {
        organizationId: oid,
        courseId: cid,
      },
      relations: ['course', 'course.semester'],
    });

    if (!courseInfo) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
    }

    if (!courseDetails.name || courseDetails.name.trim().length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.courseNameTooShort,
      });
    }

    if (
      courseInfo.course.coordinator_email &&
      (!courseDetails.coordinator_email ||
        courseDetails.coordinator_email.trim().length < 1)
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.coordinatorEmailTooShort,
      });
    }

    if (
      courseInfo.course.sectionGroupName &&
      (!courseDetails.sectionGroupName ||
        courseDetails.sectionGroupName.trim().length < 1)
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.sectionGroupNameTooShort,
      });
    }

    if (
      !courseDetails.timezone ||
      !COURSE_TIMEZONES.find((timezone) => timezone === courseDetails.timezone)
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: `Timezone field is invalid, must be one of ${COURSE_TIMEZONES.join(
          ', ',
        )}`,
      });
    }

    if (
      courseDetails.semesterName &&
      courseDetails.semesterName.trim().length < 2
    ) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterNameTooShort,
      });
    }

    const semesterDetails = courseDetails.semesterName.split(',');
    if (semesterDetails.length !== 2) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterNameFormat,
      });
    }

    if (isNaN(parseInt(semesterDetails[1]))) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.courseController.semesterYearInvalid,
      });
    }

    const semester = await SemesterModel.findOne({
      where: {
        season: semesterDetails[0],
        year: parseInt(semesterDetails[1]),
      },
      relations: ['courses'],
    });

    if (courseInfo.course.semester?.id) {
      const prevSemester = await SemesterModel.findOne({
        where: {
          id: courseInfo.course.semester.id,
        },
        relations: ['courses'],
      });

      if (prevSemester) {
        prevSemester.courses = prevSemester.courses.filter(
          (course) => course.id !== cid,
        );
        await prevSemester.save();
      }
    }

    if (!semester) {
      const newSemester = await SemesterModel.create({
        season: semesterDetails[0],
        year: parseInt(semesterDetails[1]),
        courses: [courseInfo.course],
      }).save();

      courseInfo.course.semester = newSemester;
      await courseInfo.course.save();
    } else {
      courseInfo.course.semester = semester;
      await courseInfo.course.save();
      semester.courses.push(courseInfo.course);
      await semester.save();
    }

    courseInfo.course.name = courseDetails.name;

    if (courseDetails.coordinator_email) {
      courseInfo.course.coordinator_email = courseDetails.coordinator_email;
    }

    if (courseDetails.sectionGroupName) {
      courseInfo.course.sectionGroupName = courseDetails.sectionGroupName;
    }

    courseInfo.course.zoomLink = courseDetails.zoomLink;
    courseInfo.course.timezone = courseDetails.timezone;

    try {
      await courseInfo.course.save();
      //Remove current profs
      await UserCourseModel.delete({
        courseId: cid,
        role: Role.PROFESSOR,
      });

      for (const profId of courseDetails.profIds) {
        const chosenProfessor = await UserModel.findOne({
          where: { id: profId },
        });

        if (!chosenProfessor) {
          return res.status(HttpStatus.NOT_FOUND).send({
            message: ERROR_MESSAGES.profileController.userResponseNotFound,
          });
        }

        const userCourse = await UserCourseModel.findOne({
          where: {
            userId: profId,
            courseId: cid,
          },
        });

        // user is already in the course
        if (userCourse) {
          userCourse.role = Role.PROFESSOR;
          try {
            userCourse.save();
          } catch (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
              message: err,
            });
          }
        } else {
          try {
            await UserCourseModel.create({
              userId: profId,
              courseId: cid,
              role: Role.PROFESSOR,
            }).save();
          } catch (err) {
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
              message: err,
            });
          }
        }
      }
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: err,
      });
    }

    return res.status(HttpStatus.OK).send({
      message: 'Course updated successfully',
    });
  }

  @Patch(':oid/update_course_access/:cid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async updateCourseAccess(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Param('cid', ParseIntPipe) cid: number,
  ): Promise<Response<void>> {
    const courseInfo: OrganizationCourseResponse =
      await this.organizationService.getOrganizationCourse(oid, cid);

    if (!courseInfo) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
    }

    courseInfo.course.enabled = !courseInfo.course.enabled;

    await courseInfo.course
      .save()
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'Course access updated',
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Get(':oid/get_course/:cid')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async getOrganizationCourse(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Param('cid', ParseIntPipe) cid: number,
  ): Promise<Response<OrganizationCourseResponse>> {
    const course = await this.organizationService.getOrganizationCourse(
      oid,
      cid,
    );

    if (!course) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.courseController.courseNotFound,
      });
    }

    return res.status(HttpStatus.OK).send(course);
  }

  @Get(':oid/get_banner/:photoUrl')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getBannerImage(
    @Param('photoUrl') photoUrl: string,
    @Param('oid', ParseIntPipe) oid: number,
    @Res() res: Response,
  ): Promise<void> {
    fs.stat(
      path.join(process.env.UPLOAD_LOCATION, photoUrl),
      async (err, stats) => {
        if (stats) {
          res.set('Content-Type', 'image/webp');
          res.sendFile(photoUrl, {
            root: process.env.UPLOAD_LOCATION,
          });
        } else {
          const organization = await OrganizationModel.findOne({
            where: {
              id: oid,
            },
          });

          organization.bannerUrl = null;
          await organization.save();
          return res.status(HttpStatus.NOT_FOUND).send({
            message: `Banner image for ${organization.name} not found`,
          });
        }
      },
    );
  }

  // Uses no guards as this is a public endpoint (so it shows up on login page)
  @Get(':oid/get_logo/:photoUrl')
  async getLogoImage(
    @Param('photoUrl') photoUrl: string,
    @Param('oid', ParseIntPipe) oid: number,
    @Res() res: Response,
  ): Promise<void> {
    fs.stat(
      path.join(process.env.UPLOAD_LOCATION, photoUrl),
      async (err, stats) => {
        if (stats) {
          res.set('Content-Type', 'image/webp');
          res.sendFile(photoUrl, {
            root: process.env.UPLOAD_LOCATION,
          });
        } else {
          const organization = await OrganizationModel.findOne({
            where: {
              id: oid,
            },
          });
          if (!organization) {
            return res.status(HttpStatus.NOT_FOUND).send({
              message: `Organization not found`,
            });
          }
          organization.logoUrl = null;
          await organization.save();
          return res.status(HttpStatus.NOT_FOUND).send({
            message: `Logo image for ${organization.name} not found`,
          });
        }
      },
    );
  }

  @Post(':oid/upload_banner')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<void>> {
    const organization = await OrganizationModel.findOne({
      where: {
        id: oid,
      },
    });

    if (!organization) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.organizationController.organizationNotFound,
      });
    }

    // If an old banner is still saved, delete it before saving the new one
    if (organization.bannerUrl) {
      fs.unlink(
        process.env.UPLOAD_LOCATION + '/' + organization.bannerUrl,
        (e) => {
          if (e) {
            console.error(
              'Error deleting previous picture at : ' +
                organization.bannerUrl +
                '\n Perhaps the previous image was deleted or the database is out of sync with the uploads directory for some reason.' +
                '\n Will remove this entry from the database and continue.',
            );
          }
        },
      );
    }

    const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);

    if (spaceLeft.free < 100_000_000) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: ERROR_MESSAGES.organizationController.notEnoughDiskSpace,
      });
    }

    const fileName = organization.id + '-' + Date.now().toString() + '.webp';

    // Create the upload location if it doesn't exist
    if (!fs.existsSync(process.env.UPLOAD_LOCATION)) {
      fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
    }

    const targetPath = path.join(process.env.UPLOAD_LOCATION, fileName);

    try {
      await sharp(file.buffer).resize(1920, 300).webp().toFile(targetPath);
      organization.bannerUrl = fileName;
    } catch (err) {
      console.error('Error processing image:', err);
    }

    await organization
      .save()
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'Banner uploaded',
          fileName: fileName,
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Post(':oid/upload_logo')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<Response<void>> {
    const organization = await OrganizationModel.findOne({
      where: {
        id: oid,
      },
    });

    if (!organization) {
      return res.status(HttpStatus.NOT_FOUND).send({
        message: ERROR_MESSAGES.organizationController.organizationNotFound,
      });
    }

    if (organization.logoUrl) {
      fs.unlink(
        process.env.UPLOAD_LOCATION + '/' + organization.logoUrl,
        (e) => {
          if (e) {
            console.error(
              'Error deleting previous picture at : ' +
                organization.logoUrl +
                '\n Perhaps the previous image was deleted or the database is out of sync with the uploads directory for some reason.' +
                '\n Will remove this entry from the database and continue.',
            );
          }
        },
      );
    }

    const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);

    if (spaceLeft.free < 100_000_000) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: ERROR_MESSAGES.organizationController.notEnoughDiskSpace,
      });
    }

    const fileName = organization.id + '-' + Date.now().toString() + '.webp';

    // Create the upload location if it doesn't exist
    if (!fs.existsSync(process.env.UPLOAD_LOCATION)) {
      fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
    }

    const targetPath = path.join(process.env.UPLOAD_LOCATION, fileName);

    try {
      await sharp(file.buffer).resize(100).webp().toFile(targetPath);
      organization.logoUrl = fileName;
    } catch (err) {
      console.error('Error processing image:', err);
    }

    await organization
      .save()
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'Logo uploaded',
          fileName: fileName,
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Patch(':oid/update_account_access/:uid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async updateUserAccountAccess(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
  ): Promise<Response<void>> {
    const userInfo = await UserModel.findOne({
      where: {
        id: uid,
      },
    });

    if (
      userInfo.organizationRole === OrganizationRole.ADMIN ||
      userInfo.userRole === UserRole.ADMIN
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    userInfo.accountDeactivated = !userInfo.accountDeactivated;

    await userInfo
      .save()
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'User account access updated',
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Get()
  async getAllOrganizations(
    @Res() res: Response,
  ): Promise<Response<OrganizationResponse[]>> {
    const organizations = await OrganizationModel.find({
      take: 100,
    });

    return res.status(200).send(organizations);
  }

  @Get(':oid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async get(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<void> {
    OrganizationModel.findOne({
      where: { id: oid },
    })
      .then((organization) => {
        if (!organization) {
          return res.status(HttpStatus.NOT_FOUND).send({
            message: ERROR_MESSAGES.organizationController.organizationNotFound,
          });
        }

        res.status(HttpStatus.OK).send(organization);
      })
      .catch((err) => {
        res.status(500).send({ message: err });
      });
  }

  @Get(':oid/lms_integration')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async getLmsIntegrations(
    @Param('oid', ParseIntPipe) oid: number,
  ): Promise<LMSOrganizationIntegrationPartial[]> {
    const lmsIntegrations = await LMSOrganizationIntegrationModel.find({
      where: { organizationId: oid },
      relations: ['courseIntegrations', 'courseIntegrations.course'],
    });

    if (lmsIntegrations.length <= 0) {
      return [];
    }

    return lmsIntegrations.map((int) => {
      return {
        organizationId: int.organizationId,
        apiPlatform: int.apiPlatform,
        rootUrl: int.rootUrl,
        courseIntegrations:
          int.courseIntegrations?.map((cint) => {
            return {
              courseId: cint.courseId,
              apiPlatform: int.apiPlatform,
              course: {
                id: cint.courseId,
                name: cint.course?.name,
              } satisfies CoursePartial,
              apiCourseId: cint.apiCourseId,
              apiKeyExpiry: cint.apiKeyExpiry,
            } satisfies LMSCourseIntegrationPartial;
          }) ?? [],
      } satisfies LMSOrganizationIntegrationPartial;
    });
  }

  @Post(':oid/lms_integration/upsert')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async upsertLMSIntegration(
    @Param('oid', ParseIntPipe) oid: number,
    @Body() props: any,
  ): Promise<any> {
    if (!Object.keys(LMSIntegration).includes(props.apiPlatform))
      return ERROR_MESSAGES.organizationController
        .lmsIntegrationInvalidPlatform;
    if (props.rootUrl == undefined)
      return ERROR_MESSAGES.organizationController.lmsIntegrationUrlRequired;
    if (props.rootUrl.startsWith('https') || props.rootUrl.startsWith('http'))
      return ERROR_MESSAGES.organizationController
        .lmsIntegrationProtocolIncluded;

    return await this.organizationService.upsertLMSIntegration(oid, props);
  }

  @Delete(':oid/lms_integration/remove')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async removeLMSIntegration(
    @Param('oid', ParseIntPipe) oid: number,
    @Body() body: any,
  ): Promise<any> {
    const exists = await LMSOrganizationIntegrationModel.findOne({
      where: { organizationId: oid, apiPlatform: body.apiPlatform },
    });
    if (!exists) {
      return ERROR_MESSAGES.organizationController.lmsIntegrationNotFound;
    }
    const platform = exists.apiPlatform;
    await LMSOrganizationIntegrationModel.remove(exists);
    return `Successfully deleted LMS integration for ${platform}`;
  }

  @Patch(':oid/update_user_role')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async updateUserOrganizationRole(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Body() organizationUserRolePatch: UpdateOrganizationUserRole,
  ): Promise<void> {
    await OrganizationModel.findOne({
      where: { id: oid },
    })
      .then(async (organization) => {
        if (!organization) {
          return res.status(HttpStatus.NOT_FOUND).send({
            message: ERROR_MESSAGES.organizationController.organizationNotFound,
          });
        }

        await UserModel.findOne({
          where: {
            id: organizationUserRolePatch.userId,
            organizationId: oid,
          },
        })
          .then(async (user) => {
            if (!user) {
              return res.status(HttpStatus.NOT_FOUND).send({
                message:
                  ERROR_MESSAGES.organizationController
                    .userNotFoundInOrganization,
              });
            }

            if (
              user.organizationRole === OrganizationRole.ADMIN &&
              organizationUserRolePatch.organizationRole !==
                OrganizationRole.ADMIN
            ) {
              return res.status(HttpStatus.BAD_REQUEST).send({
                message:
                  ERROR_MESSAGES.organizationController.cannotRemoveAdminRole,
              });
            }

            user.organizationRole = organizationUserRolePatch.organizationRole;

            await user
              .save()
              .then((_) => {
                res.status(HttpStatus.OK).send({
                  message: 'Organization user role updated',
                });
              })
              .catch((err) => {
                res.status(500).send({ message: err });
              });
          })
          .catch((err) => {
            res.status(500).send({ message: err });
          });
      })
      .catch((err) => {
        res.status(500).send({ message: err });
      });
  }

  @Patch(':oid/update')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async update(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Body() organizationPatch: UpdateOrganizationDetailsParams,
  ): Promise<void> {
    OrganizationModel.findOne({
      where: { id: oid },
    })
      .then((organization) => {
        if (
          !organizationPatch.name ||
          organizationPatch.name.trim().length < 3
        ) {
          return res.status(HttpStatus.BAD_REQUEST).send({
            message:
              ERROR_MESSAGES.organizationController.organizationNameTooShort,
          });
        }

        if (
          !organizationPatch.description ||
          organizationPatch.description.trim().length < 10
        ) {
          return res.status(HttpStatus.BAD_REQUEST).send({
            message:
              ERROR_MESSAGES.organizationController
                .organizationDescriptionTooShort,
          });
        }

        if (
          organizationPatch.websiteUrl &&
          (!organizationPatch.websiteUrl ||
            organizationPatch.websiteUrl.trim().length < 10 ||
            !this.isValidUrl(organizationPatch.websiteUrl))
        ) {
          return res.status(HttpStatus.BAD_REQUEST).send({
            message:
              ERROR_MESSAGES.organizationController
                .organizationUrlTooShortOrInValid,
          });
        }

        organization.name = organizationPatch.name;
        organization.description = organizationPatch.description;

        if (organizationPatch.websiteUrl) {
          organization.websiteUrl = organizationPatch.websiteUrl;
        }

        organization
          .save()
          .then((_) => {
            res.status(HttpStatus.OK).send({
              message: 'Organization updated',
            });
          })
          .catch((err) => {
            res.status(500).send({ message: err });
          });
      })
      .catch((err) => {
        res.status(500).send({ message: err });
      });
  }

  @Get(':oid/stats')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getStats(@Param('oid', ParseIntPipe) oid: number): Promise<{
    members: number;
    courses: number;
    membersProfessors: number;
  }> {
    const members = await UserModel.count({
      where: {
        organizationId: oid,
      },
    });

    const courses = await OrganizationCourseModel.count({
      where: {
        organizationId: oid,
      },
    });

    const membersProfessors = await UserModel.count({
      where: {
        organizationId: oid,
        role: OrganizationRole.PROFESSOR,
      },
    });

    return {
      members,
      courses,
      membersProfessors,
    };
  }

  @Delete(':oid/drop_user_courses/:uid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async deleteUserCourses(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() userCourses: number[],
    @UserId() userId: number,
  ): Promise<Response<void>> {
    if (userCourses.length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.noCoursesToDelete,
      });
    }

    const user = await UserModel.findOne({
      where: {
        userId,
      },
    });

    // If the user is just an OrganizationRole.PROFESSOR, they can only remove users from their own courses
    if (user.organizationRole === OrganizationRole.PROFESSOR) {
      const userCoursesForUser = await UserCourseModel.find({
        where: {
          userId: userId,
          courseId: In(userCourses),
        },
      });
      // all courses must be found, otherwise the user is trying to remove a course they are not in
      if (userCoursesForUser.length !== userCourses.length) {
        return res.status(HttpStatus.UNAUTHORIZED).send({
          message: ERROR_MESSAGES.roleGuard.notAuthorized,
        });
      }
      // Check if the user is trying to remove a course they are not in
      const userCoursesForUserIds = userCoursesForUser.map((uc) => uc.courseId);
      if (
        !userCoursesForUserIds.every((courseId) =>
          userCourses.includes(courseId),
        )
      ) {
        return res.status(HttpStatus.UNAUTHORIZED).send({
          message: ERROR_MESSAGES.roleGuard.notAuthorized,
        });
      }
    }

    const userInfo = await UserModel.findOne({
      where: {
        userId: uid,
      },
    });

    if (
      userInfo.organizationRole === OrganizationRole.ADMIN ||
      userInfo.userRole === UserRole.ADMIN
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    await this.organizationService
      .deleteUserCourses(uid, userCourses)
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'User courses deleted',
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Delete(':oid/delete_profile_picture/:uid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async deleteUserProfilePicture(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
  ): Promise<Response<void>> {
    const userInfo = await UserModel.findOne({
      where: {
        userId: uid,
      },
    });

    if (
      userInfo.organizationRole === OrganizationRole.ADMIN ||
      userInfo.userRole === UserRole.ADMIN
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    if (!userInfo.photoURL) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.noProfilePicture,
      });
    }

    fs.unlink(
      process.env.UPLOAD_LOCATION + '/' + userInfo.photoURL,
      async (err) => {
        if (err) {
          const errMessage =
            'Error deleting previous picture at : ' +
            userInfo.photoURL +
            ' the previous image was at an invalid location?';
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
            message: errMessage,
          });
        } else {
          userInfo.photoURL = null;
          await userInfo.save();
          return res.status(HttpStatus.OK).send({
            message: 'Profile picture deleted',
          });
        }
      },
    );
  }

  @Patch(':oid/edit_user/:uid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async patchUserInfo(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() userDetailsBody: UpdateProfileParams,
  ): Promise<Response<void>> {
    const userInfo = await UserModel.findOne({
      where: {
        userId: uid,
      },
      relations: ['organization'],
    });

    if (
      userInfo.organizationRole === OrganizationRole.ADMIN ||
      userInfo.userRole === UserRole.ADMIN ||
      userInfo.organization.ssoEnabled
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    const { firstName, lastName, email, sid } = userDetailsBody;

    if (firstName.trim().length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.firstNameTooShort,
      });
    }

    if (lastName.trim().length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.lastNameTooShort,
      });
    }

    if (email.trim().length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.emailTooShort,
      });
    }

    if (userInfo.sid && sid < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.sidInvalid,
      });
    }

    if (userInfo.normalizedEmail !== email.toUpperCase()) {
      const emailInUse = await UserModel.findOne({
        where: {
          normalizedEmail: email.toUpperCase(),
          organizationId: userInfo.organizationId,
        },
      });

      if (emailInUse) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message: ERROR_MESSAGES.profileController.emailInUse,
        });
      }
    }

    userInfo.firstName = firstName;
    userInfo.lastName = lastName;
    userInfo.email = email;
    userInfo.sid = sid;

    await userInfo
      .save()
      .then(() => {
        return res.status(HttpStatus.OK).send({
          message: 'User info updated',
        });
      })
      .catch((err) => {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          message: err,
        });
      });
  }

  @Get(':oid/get_user/:uid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async getUser(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
  ): Promise<Response<GetOrganizationUserResponse>> {
    const userInfo =
      await this.organizationService.getOrganizationUserByUserId(uid);

    if (userInfo.organizationRole === OrganizationRole.ADMIN) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.mustBeRoleToAccess([
          OrganizationRole.ADMIN,
        ]),
      });
    }

    return res.status(HttpStatus.OK).send(userInfo);
  }

  @Get(':oid/get_users/:page?')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getUsers(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<OrgUser[]> {
    const pageSize = 50;

    if (!search) {
      search = '';
    }

    return await this.organizationService.getUsers(oid, page, pageSize, search);
  }

  @Get(':oid/get_courses/:page?')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getCourses(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<CourseResponse[]> {
    const pageSize = 50;

    if (!search) {
      search = '';
    }

    return await this.organizationService.getCourses(
      oid,
      page,
      pageSize,
      search,
    );
  }

  @Get(':oid/get_professors/:courseId')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getProfessors(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('courseId', ParseIntPipe) cid: number,
    @Res() res: Response,
  ): Promise<Response<OrganizationProfessor[]>> {
    const orgProfs = await UserModel.find({
      where: {
        organizationId: oid,
        role: In([OrganizationRole.PROFESSOR, OrganizationRole.ADMIN]),
      },
    });

    let courseProfs = [];
    if (cid !== 0) {
      courseProfs = await UserCourseModel.find({
        where: {
          courseId: cid,
          role: Role.PROFESSOR,
        },
        relations: ['user'],
      });

      // filter out professors that are already an organization professor
      courseProfs = courseProfs.filter(
        (prof: UserCourseModel) =>
          !orgProfs.some((orgProf) => orgProf.id === prof.userId),
      );
    }

    const professors: OrganizationProfessor[] = [
      ...orgProfs.map((prof) => ({
        id: prof.id,
        name: prof.name,
      })),
      ...courseProfs.map((prof) => ({
        id: prof.user.id,
        name: prof.user.name,
        lacksProfOrgRole: true,
      })),
    ];
    return res.status(HttpStatus.OK).send(professors);
  }

  private isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };
}
