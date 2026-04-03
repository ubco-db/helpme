import {
  ERROR_MESSAGES,
  GetProfileResponse,
  UpdateProfileParams,
} from '@koh/common';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseFilePipeBuilder,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { memoryStorage } from 'multer';
import * as path from 'path';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { User, UserId } from '../decorators/user.decorator';
import { UserModel } from './user.entity';
import { ProfileService } from './profile.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import { RedisProfileService } from 'redisProfile/redis-profile.service';
import * as Sentry from '@sentry/nestjs';

@Controller('profile')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private redisProfileService: RedisProfileService,
  ) {}

  // Don't throttle this endpoint since the middleware calls this for every page (and if it prefetches like 30 pages, it will hit the throttle limit and can cause issue for the user)
  @SkipThrottle()
  @Get()
  @UseGuards(JwtAuthGuard)
  async get(
    @Req() request: any,
    @UserId() userId: number,
  ): Promise<GetProfileResponse> {
    if (userId === null || userId === undefined) {
      console.error(ERROR_MESSAGES.profileController.accountNotAvailable);
      throw new HttpException(
        ERROR_MESSAGES.profileController.accountNotAvailable,
        HttpStatus.NOT_FOUND,
      );
    }

    // Check redis for record
    const redisRecord = await this.redisProfileService.getKey(`u:${userId}`);

    if (!redisRecord) {
      // NOTE: If you are adding a new relation here (or inside profileService.getProfile), make sure to create a new EventSubscriber for inserts/updates/deletes on said relation to clear the profile cache when that relation updates.
      // Otherwise, if that relation updates, the profile cache will not be invalidated and the old data will be served.
      const user = await UserModel.findOne({
        where: { id: userId },
        relations: {
          courses: {
            course: {
              semester: true,
            },
          },
          desktopNotifs: true,
          chat_token: true,
        },
      });
      if (!user || user.accountDeactivated) {
        throw new HttpException(
          ERROR_MESSAGES.profileController.accountDeactivated,
          HttpStatus.FORBIDDEN,
        );
      }
      const profile = await this.profileService.getProfile(user);
      console.log('Fetching profile from database');
      // Update redis
      if (profile) {
        await this.redisProfileService.setProfile(`u:${user.id}`, profile);
      }

      return {
        ...profile,
        restrictPaths: request?.user?.restrictPaths,
      };
    } else {
      console.log('Fetching profile from Redis');
      return {
        ...redisRecord,
        restrictPaths: request?.user?.restrictPaths,
      };
    }
  }

  @Patch()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async patch(
    @Res() res: Response,
    @Body() userPatch: UpdateProfileParams,
    @User() user: UserModel,
  ): Promise<Response<GetProfileResponse>> {
    try {
      await this.profileService.updateUserProfile(user, userPatch);
      return res.status(200).send({ message: 'Profile updated successfully' });
    } catch (error) {
      return res.status(error.status || 500).send({ message: error.message });
    }
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
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          // Note that nestjs filetypevalidator comes with mime type and magic number validation build in
          fileType: 'jpg|jpeg|png|gif|avif|webp',
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024, // 5MB limit per file
        })
        .build({
          // TIL about status code 422 (https://beeceptor.com/docs/concepts/400-vs-422/#example-use-cases)
          // Apparently 422 is supposed to be like validation failures (request failed the business logic)
          // while 400 is supposed to be for like malformed requests (invalid json, headers).
          // So nearly all areas we currently have 400 would need to be replaced with 422
          // since nest.js already covers all the stuff like malformed requests, bad headers, etc.
          // This probably isn't worth the effort of changing, but it is interesting!
          // errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY
        }),
    )
    file: Express.Multer.File,
    @User() user: UserModel,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const fileName = await this.profileService.uploadUserProfileImage(
        file,
        user,
      );
      response
        .status(201)
        .send({ message: 'Image uploaded successfully', fileName });
    } catch (error) {
      response
        .status(500)
        .send({ message: 'Image upload failed', error: error.message });
    }
  }

  @Get('/get_pfp/:requestUserId/:photoURL')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getProfilePicture(
    @Param('requestUserId', ParseIntPipe) requestUserId: number,
    // note that we do NOT supply a user-supplied path into `fs`, we're just using this
    // as an identifier so the browser doesn't cache old pfps
    // Technically, this is bad because having the frontend handle (and send requests) the with something that directly maps to the backend's file system
    // will allow people to get hints to figure out how the backend works, that will be solved another day (when we change where photos are kept, ideally in the database).
    @Param('photoURL') photoURL: string,
    @User({ organizationUser: true, courses: true }) requester: UserModel,
    @Res() res: Response,
  ): Promise<void> {
    const requestee = await UserModel.findOne({
      relations: {
        organizationUser: true,
        courses: true,
      },
      where: { id: requestUserId },
    });
    if (!requestee) {
      throw new NotFoundException('User not found');
    }
    if (!requestee.photoURL) {
      throw new NotFoundException('User has no profile picture');
    }
    if (requestee.photoURL !== photoURL) {
      throw new NotFoundException(
        "Provided photo URL does not match the user's current photo URL. Perhaps they have updated their photo?",
      );
    }

    const canView = await this.profileService.canViewProfilePicture(
      requester,
      requestee,
    );

    if (!canView) {
      // log in sentry since this ideally shouldn't happen
      Sentry.captureException(
        new Error(
          `User ${requester.id} tried to access profile picture of ${requestee.id} but was denied`,
        ),
      );
      throw new ForbiddenException(
        'You do not have permission to view this profile picture.',
      );
    }
    fs.stat(
      path.join(process.env.UPLOAD_LOCATION, requestee.photoURL),
      async (err, stats) => {
        if (err) {
          return res
            .status(HttpStatus.NOT_FOUND)
            .send({ message: 'File not found' });
        }
        if (stats) {
          res.set('Content-Type', 'image/webp');
          res.sendFile(
            requestee.photoURL,
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
    try {
      await this.profileService.removeProfilePicture(user);
      return res
        .status(200)
        .send({ message: 'Profile picture deleted successfully' });
    } catch (error) {
      return res.status(error.status || 500).send({ message: error.message });
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
      console.error(error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .send({ message: 'Error reading changelog' });
    }
  }

  // Only 5 calls allowed in 5 minutes
  @Throttle({ default: { limit: 5, ttl: minutes(5) } })
  @Delete('/clear_cache')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async clearCache(@UserId() userId: number): Promise<void> {
    await this.redisProfileService.deleteProfile(`u:${userId}`);
  }
}
