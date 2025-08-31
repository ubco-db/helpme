import { LtiService } from './lti.service';
import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserCourse } from '../decorators/lti.decorator';
import { UserCourseModel } from '../profile/user-course.entity';
import express from 'express';
import { LtiGuard } from '../guards/lti.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { Database, PlatformModel, PlatformProperties } from 'lti-typescript';
import {
  AuthMethodEnum,
  CreateLtiPlatform,
  ERROR_MESSAGES,
  LtiPlatform,
  UpdateLtiPlatform,
} from '@koh/common';
import { plainToClass } from 'class-transformer';

@Controller('lti')
export class LtiController {
  constructor(private ltiService: LtiService) {}

  @All()
  @UseGuards(LtiGuard)
  async index(
    @Res() res: express.Response,
    @UserCourse() userCourse: UserCourseModel,
    @Query('lti_storage_target') lti_storage_target?: string,
  ) {
    const qry = new URLSearchParams();
    qry.set('cid', String(userCourse.courseId));
    if (lti_storage_target !== undefined && lti_storage_target !== null) {
      qry.set('lti_storage_target', lti_storage_target);
      qry.set(
        'auth_token',
        await this.ltiService.generateAuthToken(userCourse.userId),
      );
    } else {
      res = await this.ltiService.attachAuthToken(userCourse.userId, res);
    }
    res.redirect(`/lti${qry.size > 0 ? '?' + qry.toString() : ''}`);
  }

  @Get('/platform')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getPlatforms(): Promise<LtiPlatform[]> {
    if (!Database.dataSource.isInitialized) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiController.ltiDataSourceUninitialized,
      );
    }
    return (await Database.find(PlatformModel)).map(mapToLocalPlatform);
  }

  @Get('/platform/:kid')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getPlatform(@Param('kid') kid: string): Promise<LtiPlatform> {
    if (!Database.dataSource.isInitialized) {
      throw new BadRequestException(
        ERROR_MESSAGES.ltiController.ltiDataSourceUninitialized,
      );
    }
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
  }

  @Post('/platform')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async createPlatform(
    @Body() params: CreateLtiPlatform,
  ): Promise<LtiPlatform> {
    const platform = await this.ltiService.provider.registerPlatform(
      params as unknown as Omit<PlatformProperties, 'kid'>,
    );
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid: platform.kid } }),
    );
  }

  @Patch('/platform/:kid')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async updatePlatform(
    @Param('kid') kid: string,
    @Body() params: UpdateLtiPlatform,
  ): Promise<LtiPlatform> {
    await this.ltiService.provider.updatePlatformById(
      kid,
      params as unknown as Partial<PlatformProperties>,
    );
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
  }

  @Delete('/platform/:kid')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async deletePlatform(@Param('kid') kid: string): Promise<void> {
    await this.ltiService.provider.deletePlatformById(kid);
  }

  @Get('/static')
  async static(@Req() req: express.Request, @Res() res: express.Response) {
    res
      .status(200)
      .set('Content-Type', 'text/html')
      .send(
        '<html lang="en"><head><title>HelpMe</title></head><body><h1>Static</h1></body></html>',
      );
  }
}

function mapToLocalPlatform(platform: PlatformModel): LtiPlatform {
  if (!platform) return undefined;
  return plainToClass(LtiPlatform, {
    ...platform,
    authToken: {
      method: platform.authTokenMethod as unknown as AuthMethodEnum,
      key: platform.authTokenKey,
    },
  });
}
