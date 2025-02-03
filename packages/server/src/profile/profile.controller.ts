import {
  DesktopNotifPartial,
  ERROR_MESSAGES,
  GetProfileResponse,
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
import { OrganizationService } from '../organization/organization.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

@Controller('profile')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private redisProfileService: RedisProfileService,
    private organizationService: OrganizationService,
  ) {}

  // Don't throttle this endpoint since the middleware calls this for every page (and if it prefetches like 30 pages, it will hit the throttle limit and can cause issue for the user)
  @SkipThrottle()
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

    // Check redis for record
    const redisRecord = await this.redisProfileService.getKey(`u:${user.id}`);

    if (!redisRecord) {
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
        'readChangeLog',
      ]);

      if (userResponse === null || userResponse === undefined) {
        console.error(ERROR_MESSAGES.profileController.userResponseNotFound);
        throw new HttpException(
          ERROR_MESSAGES.profileController.userResponseNotFound,
          HttpStatus.NOT_FOUND,
        );
      }

      // this is old code from Khoury College's semester system
      //const pendingCourses = await this.profileService.getPendingCourses(user.id);
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

      const profile = {
        ...userResponse,
        courses,
        desktopNotifs,
        organization,
      };

      console.log('Fetching profile from database');

      // Update redis
      if (profile) {
        await this.redisProfileService.setProfile(`u:${user.id}`, profile);
      }

      return profile;
    } else {
      console.log('Fetching profile from Redis');
      return redisRecord;
    }
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

    // Delete old cached record if changed
    await this.redisProfileService.deleteProfile(`u:${user.id}`);

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

  // Only 10 calls allowed in 1 minute
  @Throttle({ default: { limit: 10, ttl: minutes(1) } })
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
      /*
       * The second check is for google accounts, which have a photoURL that is a external link
       */
      if (user.photoURL && !user.photoURL.startsWith('http')) {
        try {
          fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, user.photoURL));
        } catch (e) {
          console.error(
            'Error deleting previous picture at : ' +
              user.photoURL +
              '\n Perhaps the previous image was deleted or the database is out of sync with the uploads directory for some reason.' +
              '\n Will remove this entry from the database and continue.',
          );
        }
      }

      const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);

      if (spaceLeft.free < 1_000_000_000) {
        // if less than a gigabyte left
        throw new ServiceUnavailableException(
          ERROR_MESSAGES.profileController.noDiskSpace,
        );
      }
      const fileName = user.id + '-' + Date.now().toString() + '.webp';

      // Create the upload location if it doesn't exist
      if (!fs.existsSync(process.env.UPLOAD_LOCATION)) {
        fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
      }

      const targetPath = path.join(process.env.UPLOAD_LOCATION, fileName);

      try {
        await sharp(file.buffer).resize(256).webp().toFile(targetPath);
        user.photoURL = fileName;
      } catch (err) {
        console.error('Error processing image:', err);
      }
      await user.save();

      // Delete old cached record if changed
      // TODO: see if manipulating the cached data instead of refetching is more efficient
      await this.redisProfileService.deleteProfile(`u:${user.id}`);

      response
        .status(200)
        .send({ message: 'Image uploaded successfully', fileName });
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
        if (err) {
          return res
            .status(HttpStatus.NOT_FOUND)
            .send({ message: 'File not found' });
        }
        if (stats) {
          res.set('Content-Type', 'image/webp');
          res.sendFile(
            photoURL,
            { root: process.env.UPLOAD_LOCATION },
            (sendFileError) => {
              if (sendFileError) {
                return res
                  .status(HttpStatus.INTERNAL_SERVER_ERROR)
                  .send({ message: 'Error serving the image.' });
              }
            },
          );
        }
      },
    );
  }

  @Delete('/delete_profile_picture')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async deleteProfilePicture(
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    if (!user?.photoURL) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .send({ message: 'No profile picture to delete' });
    }

    if (user.photoURL.startsWith('http')) {
      user.photoURL = null;
      await user.save();
      return res
        .status(HttpStatus.OK)
        .send({ message: 'Profile picture deleted successfully' });
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
            return res
              .status(HttpStatus.OK)
              .send({ message: 'Profile picture deleted successfully' });
          }
        },
      );
    }
  }

  @Patch('/read_changelog')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async readChangelogs(
    @User() user: UserModel,
    @Res() res: Response,
  ): Promise<Response> {
    try {
      user.readChangeLog = true;
      await user.save();
      return res
        .status(HttpStatus.OK)
        .send({ message: 'Changelogs read successfully' });
    } catch (error) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: 'Error reading changelogs' });
    }
  }
}
