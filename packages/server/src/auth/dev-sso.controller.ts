import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NonProductionGuard } from '../guards/non-production.guard';
import { CourseService } from 'course/course.service';
import { ConfigService } from '@nestjs/config';
import { DevSsoIdentity, DevSsoService } from './dev-sso.service';

const DEV_SSO_BASE_PATH = '/api/v1/dev-sso';

@UseGuards(NonProductionGuard)
@Controller('dev-sso')
export class DevSsoController {
  constructor(
    private devSsoService: DevSsoService,
    private courseService: CourseService,
    private configService: ConfigService,
  ) {}

  @Get('login/:oid')
  mockSsoLoginPage(
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Query('redirect') redirect?: string,
  ): void {
    this.devSsoService.mockSsoLoginPage(
      res,
      organizationId,
      DEV_SSO_BASE_PATH,
      redirect,
    );
  }

  @Get('script.js')
  mockSsoScript(@Res() res: Response): void {
    this.devSsoService.mockSsoScript(res);
  }

  @Post('callback/:oid')
  async mockSsoCallbackPost(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() body: DevSsoIdentity,
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    return this.devSsoService.mockSsoCallback(req, res, organizationId, body, {
      basePath: DEV_SSO_BASE_PATH,
      courseService: this.courseService,
      options: {
        redirect,
        cookieOptions: {
          httpOnly: true,
          secure: this.configService
            .get<string>('DOMAIN')
            .startsWith('https://'),
        },
      },
    });
  }

  @Get('callback/:oid')
  async mockSsoCallbackGet(
    @Req() req: Request,
    @Res() res: Response,
    @Param('oid', ParseIntPipe) organizationId: number,
    @Query('email') email?: string,
    @Query('givenName') givenName?: string,
    @Query('lastName') lastName?: string,
    @Query('redirect') redirect?: string,
  ): Promise<void> {
    return this.mockSsoCallbackPost(
      req,
      res,
      organizationId,
      { email, givenName, lastName },
      redirect,
    );
  }
}
