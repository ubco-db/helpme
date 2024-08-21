import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { MailServiceModel } from './mail-services.entity';
import { MailServiceWithSubscription, OrganizationRole } from '@koh/common';
import { User } from 'decorators/user.decorator';
import { UserModel } from 'profile/user.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
@UseGuards(JwtAuthGuard)
@Controller('mail-services')
//handles notfication settings for emails
export class MailServicesController {
  constructor(private mailService: MailService) {}

  @Get('')
  async findAll(
    @User() user: UserModel,
  ): Promise<MailServiceWithSubscription[]> {
    const organizationUser = await OrganizationUserModel.findOne({
      where: { userId: user.id },
    });
    if (!Object.values(OrganizationRole).includes(organizationUser.role)) {
      throw new HttpException('Invalid role', HttpStatus.BAD_REQUEST);
    }

    return this.mailService.findAll(organizationUser.role, user);
  }

  @Post()
  async create(
    @Body() mailService: MailServiceModel,
  ): Promise<MailServiceModel> {
    return this.mailService.create(mailService);
  }

  @Patch(':id')
  async update(
    @Param('id') id: number,
    @Body() mailService: MailServiceModel,
  ): Promise<MailServiceModel> {
    return this.mailService.update(id, mailService);
  }

  @Delete(':id')
  async remove(@Param('id') id: number): Promise<void> {
    await this.mailService.remove(id);
  }
}
