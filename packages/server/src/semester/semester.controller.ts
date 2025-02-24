import { OrganizationRole, SemesterPartial } from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SemesterModel } from './semester.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { OrganizationRolesGuard } from '../guards/organization-roles.guard';
import { OrganizationGuard } from 'guards/organization.guard';
import { OrganizationModel } from 'organization/organization.entity';
import { Roles } from 'decorators/roles.decorator';

@Controller('semesters')
export class SemesterController {
  @Get(':oid')
  @UseGuards(
    JwtAuthGuard,
    OrganizationRolesGuard,
    OrganizationGuard,
    EmailVerifiedGuard,
  )
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async getSemesters(
    @Param('oid', ParseIntPipe) organizationId: number,
  ): Promise<SemesterPartial[]> {
    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const semesters = await SemesterModel.find({
      where: { organizationId: organization.id },
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
  async createSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() semesterDetails: SemesterPartial,
  ): Promise<void> {
    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
      relations: ['semesters'],
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }
  }
}
