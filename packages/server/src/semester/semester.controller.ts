import { OrganizationRole, SemesterPartial } from '@koh/common';
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
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard) // safe for anyone to fetch (needed for semester filtering in courses page)
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
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async createSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Body() semesterDetails: SemesterPartial,
  ): Promise<string> {
    const organization = await OrganizationModel.findOne({
      where: { id: organizationId },
      relations: ['semesters'],
    });

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    try {
      await SemesterModel.create({
        ...semesterDetails,
        organization,
      }).save();

      return 'Semester created successfully';
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
  @Roles(OrganizationRole.ADMIN, OrganizationRole.PROFESSOR)
  async updateSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Param('sid', ParseIntPipe) semesterId: number,
    @Body() semesterDetails: SemesterPartial,
  ): Promise<string> {
    const semester = await SemesterModel.findOne({
      where: { id: semesterId, organizationId },
    });

    if (!semester) {
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
  async deleteSemester(
    @Param('oid', ParseIntPipe) organizationId: number,
    @Param('sid', ParseIntPipe) semesterId: number,
  ): Promise<string> {
    const semester = await SemesterModel.findOne({
      where: { id: semesterId, organizationId },
    });

    if (!semester) {
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
