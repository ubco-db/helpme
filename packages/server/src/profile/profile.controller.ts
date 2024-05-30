import {
  DesktopNotifPartial,
  ERROR_MESSAGES,
  GetProfileResponse,
  QuestionStatusKeys,
  UpdateProfileParams,
  AccountType,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as checkDiskSpace from 'check-disk-space';
import { Response } from 'express';
import * as fs from 'fs';
import { pick } from 'lodash';
import { memoryStorage } from 'multer';
import * as path from 'path';
import * as sharp from 'sharp';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { User } from '../decorators/user.decorator';
import { UserModel } from './user.entity';
import { ProfileService } from './profile.service';
import { UserCourseModel } from './user-course.entity';
import { Role } from '@koh/common';
import { throwError } from 'rxjs';
import { QuestionModel } from 'question/question.entity';
import { OrganizationService } from '../organization/organization.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';

@Controller('profile')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private organizationService: OrganizationService,
  ) {}

  //potential problem-should fix later. Currently checking whether question in database, but student can be in different queues(so find with both queues and user id)
  //get all student in course
  @Get(':c/id')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getAllStudents(
    @Param('c') c: number,
    @Res() res: Response,
  ): Promise<any> {
    const students = await UserCourseModel.find({
      relations: ['user'],
      where: {
        courseId: c,
        role: Role.STUDENT,
      },
    });
    if (students) {
      const temp = students.map((student) => {
        return { value: student.user.name, id: student.user.id };
      });
      res.status(200).send(temp);
      return temp;
    }
  }

  @Get(':id/inQueue')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async inQueue(
    @Param('id') id: number,
    @Res() res: Response,
  ): Promise<boolean> {
    const questions = await QuestionModel.find({
      where: {
        creatorId: id,
      },
    });
    if (!questions) {
      throwError;
    }
    for (let i = 0; i < questions.length; i++) {
      if (questions[i]?.status === QuestionStatusKeys.Queued) {
        res.status(200).send(true);
        return true;
      }
    }
    res.status(200).send(false);
    return false;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async get(
    @User(['courses', 'courses.course', 'desktopNotifs', 'chat_token'])
    user: UserModel,
  ): Promise<GetProfileResponse> {
    if (user === null || user === undefined) {
      console.error(ERROR_MESSAGES.profileController.accountNotAvailable);
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountNotAvailable,
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.accountDeactivated) {
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountDeactivated,
        HttpStatus.FORBIDDEN,
      );
    }

    const courses = user.courses
      ? user.courses
          .filter((userCourse) => userCourse?.course?.enabled)
          .map((userCourse) => {
            return {
              course: {
                id: userCourse.courseId,
                name: userCourse.course.name,
              },
              role: userCourse.role,
            };
          })
      : [];

    const desktopNotifs: DesktopNotifPartial[] = user.desktopNotifs
      ? user.desktopNotifs.map((d) => ({
          endpoint: d.endpoint,
          id: d.id,
          createdAt: d.createdAt,
          name: d.name,
        }))
      : [];

    const userResponse = pick(user, [
      'id',
      'email',
      'name',
      'sid',
      'firstName',
      'lastName',
      'photoURL',
      'defaultMessage',
      'includeDefaultMessage',
      'desktopNotifsEnabled',
      'insights',
      'userRole',
      'accountType',
      'emailVerified',
      'chat_token',
    ]);

    if (userResponse === null || userResponse === undefined) {
      console.error(ERROR_MESSAGES.profileController.userResponseNotFound);
      throw new HttpException(
        ERROR_MESSAGES.profileController.userResponseNotFound,
        HttpStatus.NOT_FOUND,
      );
    }

    const pendingCourses = await this.profileService.getPendingCourses(user.id);
    const userOrganization =
      await this.organizationService.getOrganizationAndRoleByUserId(user.id);

    const organization = pick(userOrganization, [
      'id',
      'orgId',
      'organizationName',
      'organizationDescription',
      'organizationLogoUrl',
      'organizationBannerUrl',
      'organizationRole',
    ]);

    return {
      ...userResponse,
      courses,
      desktopNotifs,
      pendingCourses,
      organization,
    };
  }

  @Patch()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async patch(
    @Res() res: Response,
    @Body() userPatch: UpdateProfileParams,
    @User()
    user: UserModel,
  ): Promise<Response<GetProfileResponse>> {
    if (user.accountType !== AccountType.LEGACY && userPatch.email) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .send({ message: ERROR_MESSAGES.profileController.cannotUpdateEmail });
    }

    if (userPatch.email && userPatch.email !== user.email) {
      const email = await UserModel.findOne({
        where: {
          email: userPatch.email,
        },
      });

      if (email) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: ERROR_MESSAGES.profileController.emailAlreadyInDb });
      }
    }

    if (userPatch.sid && userPatch.sid !== user.sid) {
      const sid = await UserModel.findOne({
        where: {
          sid: userPatch.sid,
        },
      });

      if (sid) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .send({ message: ERROR_MESSAGES.profileController.sidAlreadyInDb });
      }
    }

    user = Object.assign(user, userPatch);

    await user
      .save()
      .then(() => {
        return this.get(user);
      })
      .catch((e) => {
        console.log(e);
      });

    return res.status(200).send({ message: 'Profile updated successfully' });
  }

  @Post('/upload_picture')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @User() user: UserModel,
    @Res() response: Response,
  ): Promise<void> {
    try {
      if (user.photoURL && !user.photoURL.startsWith('http')) {
        fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, user.photoURL));
      }

      const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);

      if (spaceLeft.free < 1_000_000_000) {
        // if less than a gigabyte left
        throw new ServiceUnavailableException(
          ERROR_MESSAGES.profileController.noDiskSpace,
        );
      }
      const fileName =
        user.id +
        '-' +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      if (!fs.existsSync(process.env.UPLOAD_LOCATION)) {
        fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
      }

      const targetPath = path.join(process.env.UPLOAD_LOCATION, fileName);

      await sharp(file.buffer).resize(256).toFile(targetPath);
      user.photoURL = fileName;
      await user.save();
      response.status(200).send({ message: 'Image uploaded successfully' });
    } catch (error) {
      response
        .status(500)
        .send({ message: 'Image upload failed', error: error.message });
    }
  }

  @Get('/get_picture/:photoURL')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getImage(
    @Param('photoURL') photoURL: string,
    @Res() res: Response,
  ): Promise<void> {
    fs.stat(
      path.join(process.env.UPLOAD_LOCATION, photoURL),
      async (err, stats) => {
        if (stats) {
          res.sendFile(photoURL, { root: process.env.UPLOAD_LOCATION });
        } else {
          const user = await UserModel.findOne({
            where: {
              photoURL,
            },
          });
          user.photoURL = null;
          await user.save();
          throw new NotFoundException();
        }
      },
    );
  }

  @Delete('/delete_profile_picture')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async deleteProfilePicture(@User() user: UserModel): Promise<void> {
    if (user.photoURL) {
      if (user.photoURL.startsWith('http')) {
        user.photoURL = null;
        await user.save();
        return;
      } else {
        fs.unlink(
          process.env.UPLOAD_LOCATION + '/' + user.photoURL,
          async (err) => {
            if (err) {
              const errMessage =
                'Error deleting previous picture at : ' +
                user.photoURL +
                'the previous image was at an invalid location?';
              console.error(errMessage, err);
              throw new BadRequestException(errMessage);
            } else {
              user.photoURL = null;
              await user.save();
              return;
            }
          },
        );
      }
    }
  }
}
