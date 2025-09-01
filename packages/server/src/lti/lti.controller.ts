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
import { LtiCourseId, LtiUser } from '../decorators/lti.decorator';
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
import { UserModel } from '../profile/user.entity';

@Controller('lti')
export class LtiController {
  constructor(private ltiService: LtiService) {}

  @All()
  @UseGuards(LtiGuard)
  async index(
    @Res() res: express.Response,
    @LtiUser({ organizationUser: true }) user: UserModel,
    @LtiCourseId() courseId?: number,
    @Query('lti_storage_target') lti_storage_target?: string,
  ) {
    const qry = new URLSearchParams();
    if (courseId) {
      qry.set('cid', String(courseId));
    }
    const auth = await this.ltiService.generateAuthToken(user.id);
    if (lti_storage_target) {
      qry.set('auth_token', auth);
      qry.set('lti_storage_target', lti_storage_target);
    } else {
      res = await this.ltiService.attachAuthToken(user.id, res, auth);
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

  @Patch('/platform/:kid/toggle')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async togglePlatform(@Param('kid') kid: string): Promise<LtiPlatform> {
    const platform = await this.ltiService.provider.getPlatformById(kid);
    if (platform) {
      await platform.setActive(!platform.active);
    }
    return mapToLocalPlatform(
      await Database.findOne(PlatformModel, { where: { kid } }),
    );
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
