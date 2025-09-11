import { ERROR_MESSAGES, OrganizationRole, SemesterPartial } from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SemesterModel } from './semester.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from 'guards/organization.guard';
import { OrganizationModel } from 'organization/organization.entity';
import { Roles } from 'decorators/roles.decorator';
import { OrgRole } from '../decorators/org-role.decorator';
import { OrganizationService } from '../organization/organization.service';

@Controller('semesters')
export class SemesterController {
  constructor(private organizationService: OrganizationService) {}

  @Get(':oid')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OrganizationRolesGuard) // safe for anyone to fetch (needed for semester filtering in courses page)
  @Roles(
    OrganizationRole.MEMBER,
    OrganizationRole.PROFESSOR,
    OrganizationRole.ADMIN,
  ) // only allow those in the org to access these
  async getSemesters(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<SemesterPartial[]> {
    try {
      await OrganizationModel.findOneOrFail({
        where: { id: organizationId },
      });
    } catch {
      throw new BadRequestException('Organization not found');
    }

    const semesters = await SemesterModel.find({
      where: { organizationId: organizationId },
      order: {
        endDate: 'DESC',
      },
    });

    return semesters;
  }

  @Post(':oid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async createSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @OrgRole() orgRole: OrganizationRole,
    @Body() semesterDetails: SemesterPartial,
  ): Promise<SemesterPartial> {
    console.log(semesterDetails);
    try {
      await OrganizationModel.findOneOrFail({
        where: { id: organizationId },
      });
    } catch {
      throw new BadRequestException('Organization not found');
    }

    const orgSettings =
      await this.organizationService.getOrganizationSettings(organizationId);
    if (
      !orgSettings.allowProfCourseCreate &&
      orgRole == OrganizationRole.PROFESSOR
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.semesterController.notAllowedToCreateSemester(orgRole),
      );
    }

    try {
      const newSemester = await SemesterModel.create({
        ...semesterDetails,
        organizationId,
      }).save();

      return newSemester;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to create semester');
    }
  }

  @Patch(':oid/:sid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async updateSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Param('sid', ParseIntPipe) semesterId: number,
    @OrgRole() orgRole: OrganizationRole,
    @Body() semesterDetails: SemesterPartial,
  ): Promise<string> {
    const orgSettings =
      await this.organizationService.getOrganizationSettings(organizationId);
    if (
      !orgSettings.allowProfCourseCreate &&
      orgRole == OrganizationRole.PROFESSOR
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.semesterController.notAllowedToUpdateSemester(orgRole),
      );
    }

    try {
      await SemesterModel.findOneOrFail({
        where: { id: semesterId, organizationId },
      });
    } catch {
      throw new BadRequestException('Semester not found');
    }

    try {
      await SemesterModel.update(semesterId, semesterDetails);

      return 'Semester updated successfully';
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to update semester');
    }
  }

  @Delete(':oid/:sid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN)
  async deleteSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Param('sid', ParseIntPipe) semesterId: number,
    @OrgRole() orgRole: OrganizationRole,
  ): Promise<string> {
    const orgSettings =
      await this.organizationService.getOrganizationSettings(organizationId);
    if (
      !orgSettings.allowProfCourseCreate &&
      orgRole == OrganizationRole.PROFESSOR
    ) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.semesterController.notAllowedToDeleteSemester(orgRole),
      );
    }

    try {
      await SemesterModel.findOneOrFail({
        where: { id: semesterId, organizationId },
      });
    } catch {
      throw new BadRequestException('Semester not found');
    }

    try {
      await SemesterModel.delete(semesterId);

      return 'Semester deleted successfully';
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Failed to delete semester');
    }
  }
}
