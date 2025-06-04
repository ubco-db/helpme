import {
  AccountType,
  DesktopNotifPartial,
  ERROR_MESSAGES,
  GetProfileResponse,
  Role,
  UpdateProfileParams,
  User,
} from '@koh/common';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UserModel } from './user.entity';
import { pick } from 'lodash';
import { OrganizationService } from '../organization/organization.service';
import checkDiskSpace from 'check-disk-space';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

@Injectable()
export class ProfileService {
  constructor(private organizationService: OrganizationService) {}

  async getProfile(user: UserModel): Promise<User> {
    const courses = user.courses
      ? user.courses
          .filter(
            (userCourse) =>
              userCourse?.course?.enabled ||
              userCourse?.role === Role.PROFESSOR,
          )
          .map((userCourse) => {
            return {
              course: {
                id: userCourse.courseId,
                name: userCourse.course.name,
                semesterId: userCourse.course.semesterId,
                enabled: userCourse.course.enabled,
                sectionGroupName: userCourse.course.sectionGroupName,
              },
              role: userCourse.role,
              favourited: userCourse.favourited,
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
    } as User;

    return profile;
  }

  async uploadUserProfileImage(
    file: Express.Multer.File,
    user: UserModel,
  ): Promise<string> {
    try {
      // Remove previous profile picture (if it's not an external URL)
      if (user.photoURL && !user.photoURL.startsWith('http')) {
        this.deletePreviousImage(user.photoURL);
      }

      // Check disk space before proceeding
      const spaceLeft = await checkDiskSpace(path.parse(process.cwd()).root);
      if (spaceLeft.free < 1_000_000_000) {
        throw new ServiceUnavailableException(
          ERROR_MESSAGES.profileController.noDiskSpace,
        );
      }

      const fileName = `${user.id}-${Date.now()}.webp`;
      const targetPath = path.join(process.env.UPLOAD_LOCATION, fileName);

      // Ensure the upload directory exists
      if (!fs.existsSync(process.env.UPLOAD_LOCATION)) {
        fs.mkdirSync(process.env.UPLOAD_LOCATION, { recursive: true });
      }

      // Process and save the image
      await sharp(file.buffer).resize(256).webp().toFile(targetPath);
      user.photoURL = fileName;
      await user.save();

      return fileName;
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  }

  private deletePreviousImage(filePath: string): void {
    try {
      fs.unlinkSync(path.join(process.env.UPLOAD_LOCATION, filePath));
    } catch (e) {
      console.error(
        `Error deleting previous picture at: ${filePath}\n` +
          `Perhaps the file was already deleted or the database is out of sync with the uploads directory.\n` +
          `Will remove this entry from the database and continue.`,
      );
    }
  }

  async updateUserProfile(
    user: UserModel,
    userPatch: UpdateProfileParams,
  ): Promise<GetProfileResponse> {
    if (user.accountType !== AccountType.LEGACY && userPatch.email) {
      throw new BadRequestException(
        ERROR_MESSAGES.profileController.cannotUpdateEmail,
      );
    }

    // Check if the new email is already in use
    if (userPatch.email && userPatch.email !== user.email) {
      const emailExists = await UserModel.findOne({
        where: { email: userPatch.email },
      });
      if (emailExists) {
        throw new BadRequestException(
          ERROR_MESSAGES.profileController.emailAlreadyInDb,
        );
      }
    }

    // Check if the new student ID (sid) is already in use
    if (userPatch.sid && userPatch.sid !== user.sid) {
      const sidExists = await UserModel.findOne({
        where: { sid: userPatch.sid },
      });
      if (sidExists) {
        throw new BadRequestException(
          ERROR_MESSAGES.profileController.sidAlreadyInDb,
        );
      }
    }

    // Update user with new data
    Object.assign(user, userPatch);

    // Save updated user
    await user.save();

    return user;
  }

  async removeProfilePicture(user: UserModel): Promise<void> {
    if (!user?.photoURL) {
      throw new NotFoundException('No profile picture to delete');
    }

    if (user.photoURL.startsWith('http')) {
      user.photoURL = null;
      await user.save();
      return;
    }

    const filePath = path.join(process.env.UPLOAD_LOCATION, user.photoURL);

    try {
      await fs.promises.unlink(filePath);
      user.photoURL = null;
      await user.save();
    } catch (err) {
      console.error(`Error deleting profile picture at: ${filePath}`, err);
      throw new BadRequestException(
        'Error deleting profile picture. The file may not exist.',
      );
    }
  }
}
