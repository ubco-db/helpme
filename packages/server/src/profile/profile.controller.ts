import {
  ERROR_MESSAGES,
  GetProfileResponse,
  UpdateProfileParams,
} from '@koh/common';
import {
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
import { User } from '../decorators/user.decorator';
import { UserModel } from './user.entity';
import { ProfileService } from './profile.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import { RedisProfileService } from 'redisProfile/redis-profile.service';

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
    @User({
      courses: {
        course: true,
      },
      desktopNotifs: true,
      chat_token: true,
    })
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
      const profile = await this.profileService.getProfile(user);
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
    @UploadedFile() file: Express.Multer.File,
    @User() user: UserModel,
    @Res() response: Response,
  ): Promise<void> {
    try {
      const fileName = await this.profileService.uploadUserProfileImage(
        file,
        user,
      );
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

      // Delete old cached record if changed
      await this.redisProfileService.deleteProfile(`u:${user.id}`);

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
