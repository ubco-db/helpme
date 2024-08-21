import {
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
  HttpException,
  HttpStatus,
  Body,
} from '@nestjs/common';
import { MailService } from './mail.service';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { MailServiceModel } from './mail-services.entity';
import { MailServiceWithSubscription, OrganizationRole } from '@koh/common';
import { User } from 'decorators/user.decorator';
import { UserModel } from 'profile/user.entity';
import { OrganizationUserModel } from 'organization/organization-user.entity';
import { UserSubscriptionModel } from './user-subscriptions.entity';
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

  @Patch(':mailServiceId')
  async update(
    @Param('mailServiceId') id: number,
    @User() user: UserModel,
    @Body('isSubscribed') isSubscribed: boolean,
  ): Promise<UserSubscriptionModel> {
    let subscription = await UserSubscriptionModel.findOne({
      where: {
        userId: user.id,
        serviceId: id,
      },
    });

    if (!subscription) {
      // If no subscription exists, create a new one
      const mailService = await MailServiceModel.findOne(id);
      if (!mailService) {
        throw new HttpException('Invalid mail service', HttpStatus.BAD_REQUEST);
      }

      subscription = new UserSubscriptionModel();
      subscription.userId = user.id;
      subscription.serviceId = id;
    }

    subscription.isSubscribed = isSubscribed;
    await subscription.save();

    return subscription;
  }
}
