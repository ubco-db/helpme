import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserModel } from 'profile/user.entity';
import { Response } from 'express';
import {
  BatchCourseCloneAttributes,
  COURSE_TIMEZONES,
  CourseResponse,
  CourseSettingsRequestBody,
  CreateCourseResponse,
  ERROR_MESSAGES,
  GetOrganizationResponse,
  GetOrganizationUserResponse,
  GetOrganizationUsersPaginatedResponse,
  OrganizationProfessor,
  OrganizationResponse,
  OrganizationRole,
  OrganizationRoleHistoryFilter,
  OrganizationRoleHistoryResponse,
  OrganizationSettingsRequestBody,
  OrganizationSettingsResponse,
  OrgRoleChangeReason,
  OrgUser,
  Role,
  UpdateOrganizationCourseDetailsParams,
  UpdateOrganizationDetailsParams,
  UpdateOrganizationUserRole,
  UpdateProfileParams,
  UserRole,
} from '@koh/common';
import * as fs from 'fs';
import { OrganizationUserModel } from './organization-user.entity';
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
import { SemesterModel } from '../semester/semester.entity';
import { DataSource, In } from 'typeorm';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseSettingsModel } from '../course/course_settings.entity';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { ChatTokenModel } from '../chatbot/chat-token.entity';
import { v4 } from 'uuid';
import * as sharp from 'sharp';
import { User } from 'decorators/user.decorator';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { OrgOrCourseRolesGuard } from 'guards/org-or-course-roles.guard';
import { OrgRoles } from 'decorators/org-roles.decorator';
import { CourseRoles } from 'decorators/course-roles.decorator';
import { CourseService } from 'course/course.service';
import { ParseDatePipe } from '@nestjs/common/pipes/parse-date.pipe';
import { OrgRole } from '../decorators/org-role.decorator';
import * as crypto from 'crypto';

// TODO: put the error messages in ERROR_MESSAGES object

@Controller('organization')
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private courseService: CourseService,
    private schedulerRegistry: SchedulerRegistry,
    private dataSource: DataSource,
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
              FROM organization_user_model
              WHERE organization_user_model."userId" = public.chat_token_model.user
                AND organization_user_model.role != 'member'
                AND organization_user_model."organizationId" = $1
            ) THEN 300
            ELSE 30
          END 
      WHERE public.chat_token_model.user IN (
        SELECT "userId"
        FROM organization_user_model
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
      // Get all users for the organization with their highest role
      // update: this query can probably be updated to just grab userids of all org users but this is a admin route so me
      const orgUsers: {
        userId: number;
        role: 'professor' | 'admin' | 'member';
      }[] = await this.dataSource.query(
        `
  SELECT ou."userId",
         CASE
           WHEN EXISTS (
             SELECT 1 
             FROM user_course_model uc 
             WHERE uc."userId" = ou."userId" AND uc.role != 'student'
           ) THEN 'professor'
           ELSE ou.role
         END AS role
  FROM organization_user_model ou
  WHERE ou."organizationId" = $1
  `,
        [oid],
      );

      // Get all mail services
      const mailServices = await this.dataSource.query(`
        SELECT id, "mailType", "serviceType"
        FROM mail_services
      `);

      // Prepare arrays for bulk insert
      const subscriptionsToInsert = [];

      // instead of subscribing users to specific services based on their role, we are going to subscribe them to all services
      // And then we will simply add the staff checks to the controllers that send the emails
      // This is because roles are not static, and that it would be a lot more annoying to adjust all the endpoints that update roles to also update their subscription.
      // It's just a lot easier to check their role at the time the email needs to be sent then syncing this

      for (const user of orgUsers) {
        for (const service of mailServices) {
          subscriptionsToInsert.push([user.userId, service.id, true]);
        }
      }

      // Bulk insert subscriptions
      if (subscriptionsToInsert.length > 0) {
        await this.dataSource.query(
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
    const organizationUsers = await OrganizationUserModel.find({
      where: {
        organizationId: oid,
      },
      relations: ['organizationUser', 'organizationUser.chat_token'],
    });

    let chatTokenCount = 0;
    organizationUsers.forEach(async (organizationUser) => {
      const ou = organizationUser.organizationUser;

      if (!ou.chat_token) {
        await ChatTokenModel.create({
          user: ou,
          token: v4(),
        }).save();
      } else {
        chatTokenCount += 1;
      }
    });

    if (chatTokenCount === organizationUsers.length) {
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
    @OrgRole() orgRole: OrganizationRole,
    @Body() courseDetails: UpdateOrganizationCourseDetailsParams,
    @Res() res: Response,
  ): Promise<Response<CreateCourseResponse>> {
    const orgSettings =
      await this.organizationService.getOrganizationSettings(oid);
    if (
      !orgSettings.allowProfCourseCreate &&
      orgRole == OrganizationRole.PROFESSOR
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.organizationController.notAllowedToCreateCourse(orgRole),
      );
    }

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
    let newCourse: CourseModel;
    await this.dataSource.transaction(async (manager) => {
      // Create course entity
      newCourse = manager.create(CourseModel, {
        name: courseDetails.name,
        coordinator_email: courseDetails.coordinator_email,
        sectionGroupName: courseDetails.sectionGroupName,
        zoomLink: courseDetails.zoomLink,
        timezone: courseDetails.timezone,
        enabled: true,
        courseInviteCode: crypto.randomBytes(6).toString('hex'),
      });

      await manager.save(newCourse);

      // Attach professors if any
      if (courseDetails.profIds) {
        for (const profId of courseDetails.profIds) {
          const chosenProfessor = await manager.findOne(UserModel, {
            where: { id: profId },
          });

          if (!chosenProfessor) {
            throw new HttpException(
              `Professor with ID ${profId} not found`,
              HttpStatus.NOT_FOUND,
            );
          }

          const userCourse = manager.create(UserCourseModel, {
            user: chosenProfessor,
            course: newCourse,
            role: Role.PROFESSOR,
            expires: false,
          });
          await manager.save(userCourse);
        }
      }

      // Add to organization
      const orgCourse = manager.create(OrganizationCourseModel, {
        organizationId: oid,
        course: newCourse,
      });
      await manager.save(orgCourse);

      // Check semester (-1 signifies that no semester was set)
      if (courseDetails.semesterId && courseDetails.semesterId !== -1) {
        const semester = await manager.findOne(SemesterModel, {
          where: { id: courseDetails.semesterId },
          relations: ['courses'],
        });
        if (!semester) {
          throw new HttpException(`Semester not found`, HttpStatus.NOT_FOUND);
        }
        newCourse.semester = semester;
        await manager.save(newCourse);
      }

      // Create default settings
      const newCourseSettings = manager.create(CourseSettingsModel, {
        courseId: newCourse.id,
      });
      if (courseDetails.courseSettings) {
        for (const givenFeature of courseDetails.courseSettings) {
          if (!CourseSettingsRequestBody.isValidFeature(givenFeature.feature)) {
            throw new HttpException(
              'invalid feature: ' + givenFeature.feature,
              HttpStatus.BAD_REQUEST,
            );
          }
          newCourseSettings[givenFeature.feature] = givenFeature.value;
        }
      }
      await manager.save(newCourseSettings);
    });

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
      courseId: newCourse.id,
    });
  }

  @Patch(':oid/update_course/:cid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrgOrCourseRolesGuard)
  @CourseRoles(Role.PROFESSOR)
  @OrgRoles(OrganizationRole.ADMIN)
  async updateCourse(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) oid: number,
    @Param('cid', ParseIntPipe) cid: number,
    @Body() courseDetails: UpdateOrganizationCourseDetailsParams,
    @User({ organizationUser: true }) user: UserModel,
  ): Promise<Response<void>> {
    await this.dataSource.transaction(async (manager) => {
      const courseInfo = await manager.findOne(OrganizationCourseModel, {
        where: {
          organizationId: oid,
          courseId: cid,
        },
        relations: ['course', 'course.semester'],
      });

      if (!courseInfo) {
        throw new HttpException(
          ERROR_MESSAGES.courseController.courseNotFound,
          HttpStatus.NOT_FOUND,
        );
      }

      if (!courseDetails.name || courseDetails.name.trim().length < 1) {
        throw new HttpException(
          ERROR_MESSAGES.courseController.courseNameTooShort,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        courseInfo.course.coordinator_email &&
        (!courseDetails.coordinator_email ||
          courseDetails.coordinator_email.trim().length < 1)
      ) {
        throw new HttpException(
          ERROR_MESSAGES.courseController.coordinatorEmailTooShort,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        courseInfo.course.sectionGroupName &&
        (!courseDetails.sectionGroupName ||
          courseDetails.sectionGroupName.trim().length < 1)
      ) {
        throw new HttpException(
          ERROR_MESSAGES.courseController.sectionGroupNameTooShort,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (
        !courseDetails.timezone ||
        !COURSE_TIMEZONES.find(
          (timezone) => timezone === courseDetails.timezone,
        )
      ) {
        throw new HttpException(
          `Timezone field is invalid, must be one of ${COURSE_TIMEZONES.join(
            ', ',
          )}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      if (courseDetails.semesterId && courseDetails.semesterId !== -1) {
        const semester = await manager.findOne(SemesterModel, {
          where: { id: courseDetails.semesterId },
          relations: ['courses'],
        });
        if (!semester) {
          throw new HttpException(`Semester not found`, HttpStatus.NOT_FOUND);
        }

        courseInfo.course.semester = semester;
      } else if (courseDetails.semesterId && courseDetails.semesterId === -1) {
        courseInfo.course.semester = null;
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

      await manager.save(courseInfo.course);

      // If user is an admin, update professors according to list
      if (user.organizationUser.role == OrganizationRole.ADMIN) {
        // Retrieve any current professors
        const currentProfs = await manager.find(UserCourseModel, {
          where: {
            courseId: cid,
            role: Role.PROFESSOR,
          },
        });

        const demoted = currentProfs
          .filter((v) => !courseDetails.profIds.includes(v.userId))
          .map((v) => v.id);
        const promoted = courseDetails.profIds.filter(
          (v0) => !currentProfs.some((v1) => v0 == v1.userId),
        );

        // Demote professors not specified in list back to student
        await manager.update(
          UserCourseModel,
          { id: In(demoted) },
          { role: Role.STUDENT },
        );

        // Upsert professors specified in list
        for (const profId of promoted) {
          const chosenProfessor = await manager.findOne(UserModel, {
            where: { id: profId },
          });

          if (!chosenProfessor) {
            throw new HttpException(
              ERROR_MESSAGES.profileController.userResponseNotFound,
              HttpStatus.NOT_FOUND,
            );
          }

          try {
            const exists = await manager.findOne(UserCourseModel, {
              where: {
                userId: profId,
                courseId: cid,
              },
            });
            if (exists) {
              exists.role = Role.PROFESSOR;
              await manager.save(exists);
            } else {
              await manager
                .create(UserCourseModel, {
                  userId: profId,
                  courseId: cid,
                  role: Role.PROFESSOR,
                })
                .save();
            }
          } catch (err) {
            console.error(err);
            throw new HttpException(err, HttpStatus.INTERNAL_SERVER_ERROR);
          }
        }
      }
    });

    return res.status(HttpStatus.OK).send({
      message: 'Course updated successfully',
    });
  }

  // For course archival
  @Patch(':oid/update_course_access/:cid')
  @UseGuards(JwtAuthGuard, OrgOrCourseRolesGuard, EmailVerifiedGuard)
  @CourseRoles(Role.PROFESSOR)
  @OrgRoles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
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
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrgOrCourseRolesGuard)
  @CourseRoles(Role.PROFESSOR, Role.TA)
  @OrgRoles(OrganizationRole.ADMIN)
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
    const userInfo = await OrganizationUserModel.findOne({
      where: {
        userId: uid,
      },
      relations: ['organizationUser'],
    });

    if (
      userInfo.role === OrganizationRole.ADMIN ||
      userInfo.organizationUser.userRole === UserRole.ADMIN
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    userInfo.organizationUser.accountDeactivated =
      !userInfo.organizationUser.accountDeactivated;

    await userInfo.organizationUser
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
    try {
      const organization = await OrganizationModel.findOne({
        where: { id: oid },
        relations: ['semesters'],
      });

      if (!organization) {
        res.status(HttpStatus.NOT_FOUND).send({
          message: ERROR_MESSAGES.organizationController.organizationNotFound,
        });
      }

      res.status(HttpStatus.OK).send(organization as GetOrganizationResponse);
    } catch (err) {
      console.error('Error fetching organization:', err);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message:
          'An unexpected error occurred while fetching the organization.',
      });
    }
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
    @User({ organizationUser: true }) user: UserModel,
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

        await OrganizationUserModel.findOne({
          where: {
            userId: organizationUserRolePatch.userId,
            organizationId: oid,
          },
        })
          .then(async (organizationUser) => {
            if (!organizationUser) {
              return res.status(HttpStatus.NOT_FOUND).send({
                message:
                  ERROR_MESSAGES.organizationController
                    .userNotFoundInOrganization,
              });
            }

            if (
              organizationUser.role === OrganizationRole.ADMIN &&
              organizationUserRolePatch.organizationRole !==
                OrganizationRole.ADMIN
            ) {
              return res.status(HttpStatus.BAD_REQUEST).send({
                message:
                  ERROR_MESSAGES.organizationController.cannotRemoveAdminRole,
              });
            }

            const prevRole = organizationUser.role;
            organizationUser.role = organizationUserRolePatch.organizationRole;

            await organizationUser
              .save()
              .then(async (_) => {
                const maxUses = [
                  OrganizationRole.ADMIN,
                  OrganizationRole.PROFESSOR,
                ].includes(organizationUser.role)
                  ? 300
                  : 30;

                await this.dataSource.query(
                  `
                UPDATE chat_token_model
                SET max_uses = $1
                WHERE "user" = $2
                `,
                  [maxUses, organizationUser.userId],
                );

                // add role change entry
                await this.organizationService.addRoleHistory(
                  oid,
                  prevRole,
                  organizationUser.role,
                  user.organizationUser.id,
                  organizationUser.id,
                  OrgRoleChangeReason.manualModification,
                );

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
          organizationPatch.name &&
          organizationPatch.name.trim().length < 3
        ) {
          console.log(organizationPatch.name);
          return res.status(HttpStatus.BAD_REQUEST).send({
            message:
              ERROR_MESSAGES.organizationController.organizationNameTooShort,
          });
        }

        if (
          organizationPatch.description &&
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
          (organizationPatch.websiteUrl.trim().length < 10 ||
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

        if (organizationPatch.ssoEmailPatterns !== undefined) {
          organization.ssoEmailPatterns = organizationPatch.ssoEmailPatterns;
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
    const members = await OrganizationUserModel.count({
      where: {
        organizationId: oid,
      },
    });

    const courses = await OrganizationCourseModel.count({
      where: {
        organizationId: oid,
      },
    });

    const membersProfessors = await OrganizationUserModel.count({
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
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrgOrCourseRolesGuard)
  @CourseRoles(Role.PROFESSOR)
  @OrgRoles(OrganizationRole.ADMIN)
  async deleteUserCourses(
    @Res() res: Response,
    @Param('uid', ParseIntPipe) uid: number,
    @Body() userCourses: number[],
    @User({ organizationUser: true, courses: true }) user: UserModel,
  ): Promise<Response<void>> {
    if (userCourses.length < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.noCoursesToDelete,
      });
    }

    const isProfInAnyCourse = user.courses.some(
      (uc) => uc.role === Role.PROFESSOR,
    );

    // If the user is just an org or course professor, they can only remove users from their own courses
    if (
      user.organizationUser.role === OrganizationRole.PROFESSOR ||
      isProfInAnyCourse
    ) {
      const userCoursesForUser = await UserCourseModel.find({
        where: {
          userId: user.id,
          courseId: In(userCourses),
        },
      });
      // all courses must be found, otherwise the user is trying to remove a course they are not in
      if (userCoursesForUser.length !== userCourses.length) {
        return res.status(HttpStatus.FORBIDDEN).send({
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
        return res.status(HttpStatus.FORBIDDEN).send({
          message: ERROR_MESSAGES.roleGuard.notAuthorized,
        });
      }
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
    const userInfo = await OrganizationUserModel.findOne({
      where: {
        userId: uid,
      },
      relations: ['organizationUser'],
    });

    if (
      userInfo.role === OrganizationRole.ADMIN ||
      userInfo.organizationUser.userRole === UserRole.ADMIN
    ) {
      return res.status(HttpStatus.UNAUTHORIZED).send({
        message: ERROR_MESSAGES.roleGuard.notAuthorized,
      });
    }

    if (!userInfo.organizationUser.photoURL) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.noProfilePicture,
      });
    }

    fs.unlink(
      process.env.UPLOAD_LOCATION + '/' + userInfo.organizationUser.photoURL,
      async (err) => {
        if (err) {
          const errMessage =
            'Error deleting previous picture at : ' +
            userInfo.organizationUser.photoURL +
            ' the previous image was at an invalid location?';
          return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
            message: errMessage,
          });
        } else {
          userInfo.organizationUser.photoURL = null;
          await userInfo.organizationUser.save();

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
    const userInfo = await OrganizationUserModel.findOne({
      where: {
        userId: uid,
      },
      relations: ['organizationUser', 'organization'],
    });

    if (
      userInfo.role === OrganizationRole.ADMIN ||
      userInfo.organizationUser.userRole === UserRole.ADMIN ||
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

    if (userInfo.organizationUser.sid && sid < 1) {
      return res.status(HttpStatus.BAD_REQUEST).send({
        message: ERROR_MESSAGES.profileController.sidInvalid,
      });
    }

    if (userInfo.organizationUser.email !== email) {
      const emailInUse = await UserModel.findOne({
        where: {
          email,
        },
      });

      if (emailInUse) {
        return res.status(HttpStatus.BAD_REQUEST).send({
          message: ERROR_MESSAGES.profileController.emailInUse,
        });
      }
    }

    userInfo.organizationUser.firstName = firstName;
    userInfo.organizationUser.lastName = lastName;
    userInfo.organizationUser.email = email;
    userInfo.organizationUser.sid = sid;

    await userInfo.organizationUser
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

  @Get(':oid/get_users{/:page}')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getUsers(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search: string,
  ): Promise<GetOrganizationUsersPaginatedResponse> {
    const pageSize = 50;
    if (!search) {
      search = '';
    }

    return await this.organizationService.getUsers(oid, page, pageSize, search);
  }

  @Get(':oid/get_courses{/:page}')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getCourses(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('page', new DefaultValuePipe(-1), ParseIntPipe) page: number,
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
    const orgProfs = await OrganizationUserModel.find({
      where: {
        organizationId: oid,
        role: In([OrganizationRole.PROFESSOR, OrganizationRole.ADMIN]),
      },
      relations: ['organizationUser'],
    });

    let courseProfs = [];
    if (cid !== 0) {
      courseProfs = await UserCourseModel.find({
        where: {
          courseId: cid,
          role: Role.PROFESSOR,
        },
        relations: {
          user: {
            organizationUser: true,
          },
        },
      });

      // filter out professors that are already an organization professor
      courseProfs = courseProfs.filter(
        (prof) => !orgProfs.some((orgProf) => orgProf.userId === prof.userId),
      );
    }

    const professors: OrganizationProfessor[] = [
      ...orgProfs.map((prof) => ({
        organizationUser: {
          id: prof.organizationUser.id,
          name: prof.organizationUser.name,
          email: prof.organizationUser.email,
        },
        trueRole: prof.role,
        userId: prof.userId,
      })),
      ...courseProfs.map((prof) => ({
        organizationUser: {
          id: prof.user.id,
          name: prof.user.name,
          email: prof.user.email,
        },
        trueRole: prof.user.organizationUser.role,
        userId: prof.userId,
      })),
    ];
    return res.status(HttpStatus.OK).send(professors);
  }

  @Post(':oid/add_member/:uid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async addUserToOrganization(
    @Res() res: Response,
    @User({ organizationUser: true }) caller: UserModel,
    @Param('oid', ParseIntPipe) oid: number,
    @Param('uid', ParseIntPipe) uid: number,
  ): Promise<void> {
    UserModel.findOne({
      where: { id: uid },
    })
      .then((user) => {
        if (!user) {
          throw new HttpException(
            ERROR_MESSAGES.profileController.accountNotAvailable,
            HttpStatus.NOT_FOUND,
          );
        }

        OrganizationUserModel.findOne({
          where: { userId: uid, organizationId: oid },
        })
          .then((organizationUser) => {
            if (organizationUser) {
              throw new HttpException(
                ERROR_MESSAGES.organizationController.userAlreadyInOrganization,
                HttpStatus.BAD_REQUEST,
              );
            }

            const organizationUserModel = new OrganizationUserModel();
            organizationUserModel.organizationId = oid;
            organizationUserModel.userId = uid;
            organizationUserModel.role = OrganizationRole.MEMBER;

            organizationUserModel
              .save()
              .then((_) => {
                // add role change entry
                this.organizationService
                  .addRoleHistory(
                    oid,
                    null,
                    OrganizationRole.MEMBER,
                    caller.organizationUser?.id ?? null,
                    organizationUserModel.id,
                    OrgRoleChangeReason.joinedOrganizationMember,
                  )
                  .then(() =>
                    res
                      .status(200)
                      .send({ message: 'User added to organization' }),
                  );
              })
              .catch((err) => {
                console.log(err);
                res.status(500).send({ message: err });
              });
          })
          .catch((err) => {
            console.log(err);
            res.status(500).send({ message: err });
          });
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send({ message: err });
      });
  }

  @Post(':oid/clone_courses')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async batchCloneCourses(
    @Param('oid', ParseIntPipe) oid: number, // unused for now, only for the guard
    @User({ chat_token: true }) user: UserModel,
    @Body() body: BatchCourseCloneAttributes,
  ): Promise<string> {
    if (!user || !user.chat_token) {
      console.error(ERROR_MESSAGES.profileController.accountNotAvailable);
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountNotAvailable,
        HttpStatus.NOT_FOUND,
      );
    }

    this.courseService.performBatchClone(user, body);
    return 'Batch Cloning Operation Successfully Queued!';
  }

  @Get(':oid/settings')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard)
  @OrgRoles(
    OrganizationRole.ADMIN,
    OrganizationRole.PROFESSOR,
    OrganizationRole.MEMBER,
  )
  async getSettings(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<OrganizationSettingsResponse> {
    const organizationSettings =
      await this.organizationService.getOrganizationSettings(organizationId);

    const settingsResponse: Partial<OrganizationSettingsResponse> = {
      organizationId,
      ...(organizationSettings ?? {}),
      settingsFound: !!organizationSettings, // !! converts truthy/falsy into true/false
    };

    return new OrganizationSettingsResponse(settingsResponse);
  }

  @Patch(':oid/settings')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @OrgRoles(OrganizationRole.ADMIN)
  async enableDisableSetting(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: OrganizationSettingsRequestBody,
  ): Promise<void> {
    // fetch existing organization settings
    const organizationSettings =
      await this.organizationService.getOrganizationSettings(organizationId);

    // then, toggle the requested feature
    try {
      organizationSettings[body.setting] = body.value;
    } catch (err) {
      throw new BadRequestException('Invalid feature');
    }

    try {
      await organizationSettings.save();
    } catch (err) {
      throw new HttpException(
        'Error while saving course settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':oid/role_history{/:page}')
  @UseGuards(JwtAuthGuard, OrganizationRolesGuard, EmailVerifiedGuard)
  @Roles(OrganizationRole.ADMIN)
  async getRoleHistory(
    @Param('oid', ParseIntPipe) oid: number,
    @Param('page', ParseIntPipe) page: number,
    @Query('search') search?: string,
    @Query('fromRole') fromRole?: OrganizationRole,
    @Query('toRole') toRole?: OrganizationRole,
    @Query('minDate', new ParseDatePipe({ optional: true })) minDate?: Date,
    @Query('maxDate', new ParseDatePipe({ optional: true })) maxDate?: Date,
  ): Promise<OrganizationRoleHistoryResponse> {
    const pageSize = 50;

    const searchFilters = new OrganizationRoleHistoryFilter({
      search: search ?? '',
      fromRole,
      toRole,
      minDate,
      maxDate,
    });

    return await this.organizationService.getRoleHistory(
      oid,
      page,
      pageSize,
      searchFilters,
    );
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
