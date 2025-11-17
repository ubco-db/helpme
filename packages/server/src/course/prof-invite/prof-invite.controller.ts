import {
  AcceptProfInviteParams,
  CreateProfInviteParams,
  GetProfInviteResponse,
  OrganizationRole,
} from '@koh/common';
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../../decorators/roles.decorator';
import { UserId } from '../../decorators/user.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../guards/email-verified.guard';
import { ProfInviteModel } from './prof-invite.entity';
import { OrganizationRolesGuard } from 'guards/organization-roles.guard';
import { ProfInviteService } from './prof-invite.service';

@Controller('prof_invites')
@UseInterceptors(ClassSerializerInterceptor)
export class ProfInviteController {
  constructor(private profInviteService: ProfInviteService) {}

  @Get('all/:orgId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async getAllProfInvites(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query('courseId', ParseIntPipe) courseId?: number, // Providing courseId will get all prof invites for the course, otherwise it's all invites for the org
  ): Promise<GetProfInviteResponse[]> {
    const profInvites = await ProfInviteModel.find({
      where: { orgId, courseId },
      relations: { course: true, adminUser: true },
      select: {
        course: {
          id: true,
          name: true,
        },
        adminUser: {
          id: true,
          name: true,
          email: true,
        },
        id: true,
        maxUses: true,
        usesUsed: true,
        createdAt: true,
        expiresAt: true,
        code: true,
        makeOrgProf: true,
      },
    });
    return profInvites;
  }

  @Post(':orgId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async createProfInvite(
    @Param('orgId', ParseIntPipe) orgId: number,
    @UserId() userId: number,
    @Body() body: CreateProfInviteParams,
  ): Promise<GetProfInviteResponse> {
    const newProfInvite = await this.profInviteService.createProfInvite(
      orgId,
      body.courseId,
      userId,
      body.maxUses,
      body.expiresAt,
      body.makeOrgProf,
    );
    const profInviteResponse = await ProfInviteModel.findOne({
      where: { id: newProfInvite.id },
      relations: { course: true, adminUser: true },
      select: {
        course: {
          id: true,
          name: true,
        },
        adminUser: {
          id: true,
          name: true,
          email: true,
        },
        id: true,
        maxUses: true,
        usesUsed: true,
        createdAt: true,
        expiresAt: true,
        code: true,
        makeOrgProf: true,
      },
    });
    return profInviteResponse;
  }

  // assumed that this is mostly used to correct accidentally created invites rather than have all invites deleted
  @Delete(':orgId/:piid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrganizationRolesGuard)
  @Roles(OrganizationRole.ADMIN)
  async deleteProfInvite(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('piid', ParseIntPipe) piid: number,
  ): Promise<void> {
    await ProfInviteModel.delete({ id: piid });
    return;
  }

  // Allow logged-in users to accept a prof invite
  @Get('accept/:piid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async acceptProfInvite(
    @Param('piid', ParseIntPipe) piid: number,
    @Body() body: AcceptProfInviteParams,
    @UserId() userId: number,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.profInviteService.acceptProfInvite(
      userId,
      piid,
      body.code,
    );
    res.status(HttpStatus.FOUND).redirect(url);
    return;
  }

  // just returns the course id and org id for given prof invite (public endpoint)
  @Get('details/:piid')
  async getProfInviteDetails(
    @Param('piid', ParseIntPipe) piid: number,
  ): Promise<{ courseId: number; orgId: number }> {
    const profInvite = await ProfInviteModel.findOne({
      where: { id: piid },
      relations: {
        course: {
          organizationCourse: true,
        },
      },
    });
    if (!profInvite) {
      throw new NotFoundException('Prof invite not found');
    }
    return {
      courseId: profInvite.courseId,
      orgId: profInvite.course.organizationCourse.organizationId,
    };
  }
}
