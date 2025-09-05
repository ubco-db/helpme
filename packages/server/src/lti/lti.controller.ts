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
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { LtiCourseId, LtiToken, LtiUser } from '../decorators/lti.decorator';
import express from 'express';
import { LtiGuard } from '../guards/lti.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import {
  AuthTokenMethodEnum,
  Database,
  IdToken,
  PlatformModel,
  PlatformProperties,
} from 'lti-typescript';
import {
  CreateLtiPlatform,
  ERROR_MESSAGES,
  LMSIntegrationPlatform,
  LtiPlatform,
  UpdateLtiPlatform,
} from '@koh/common';
import { plainToClass } from 'class-transformer';
import { UserModel } from '../profile/user.entity';
import {
  IgnoreableClassSerializerInterceptor,
  IgnoreSerializer,
} from '../interceptors/IgnoreableClassSerializerInterceptor';

@Controller('lti')
@UseInterceptors(IgnoreableClassSerializerInterceptor)
export class LtiController {
  constructor(private ltiService: LtiService) {}

  @All()
  @UseGuards(LtiGuard)
  @IgnoreSerializer()
  async index(
    @Res() res: express.Response,
    @LtiToken() token: IdToken,
    @LtiUser({ organizationUser: true }) user: UserModel,
    @LtiCourseId() courseId?: number,
    @Query('lti_storage_target') lti_storage_target?: string,
  ) {
    const qry = new URLSearchParams();
    if (courseId) {
      qry.set('cid', String(courseId));
    }
    const platformMatch =
      Object.values(LMSIntegrationPlatform).find(
        (v) => v.toLowerCase() == token.platformInfo.product_family_code,
      ) ?? LMSIntegrationPlatform.None;

    const apiCid = LtiService.extractCourseId(token);
    qry.set('api_course_id', String(apiCid));
    qry.set('lms_platform', platformMatch);

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
}

export function mapToLocalPlatform(platform: PlatformModel): LtiPlatform {
  if (!platform) return undefined;

  const authToken = platform.authToken();
  if (authToken.method !== AuthTokenMethodEnum.JWK_SET) {
    authToken.key = '********************************';
  }

  return plainToClass(LtiPlatform, {
    ...platform,
    authToken,
  });
}
