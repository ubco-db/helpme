import {
  AlertDeliveryMode,
  CreateAlertParams,
  CreateAlertResponse,
  ERROR_MESSAGES,
  GetAlertsResponse,
  Role,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { UserId } from 'decorators/user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AlertModel } from './alerts.entity';
import { AlertsService } from './alerts.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { IsNull } from 'typeorm';

@Controller('alerts')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get(':courseId')
  async getAlerts(
    @Param('courseId', ParseIntPipe) courseId: number,
    @UserId() userId: number,
    @Query('mode') mode?: string,
    @Query('includeRead') includeRead?: string,
  ): Promise<GetAlertsResponse> {
    const parsedMode = Object.values(AlertDeliveryMode).includes(
      (mode as AlertDeliveryMode) ?? AlertDeliveryMode.MODAL,
    )
      ? (mode as AlertDeliveryMode) || AlertDeliveryMode.MODAL
      : AlertDeliveryMode.MODAL;

    const includeReadFlag = includeRead === 'true';

    const where: Record<string, unknown> = {
      courseId,
      userId,
      deliveryMode: parsedMode,
    };

    if (parsedMode === AlertDeliveryMode.MODAL) {
      where.resolved = IsNull();
    } else if (!includeReadFlag) {
      where.readAt = IsNull();
    }

    const alerts = await AlertModel.find({
      where,
      order: { sent: 'DESC' },
    });
    return { alerts: await this.alertsService.removeStaleAlerts(alerts) };
  }

  @Post()
  @Roles(Role.TA, Role.PROFESSOR)
  async createAlert(
    @Body() body: CreateAlertParams,
  ): Promise<CreateAlertResponse> {
    const { alertType, courseId, payload, targetUserId, deliveryMode } = body;
    const parsedMode = deliveryMode ?? AlertDeliveryMode.MODAL;

    if (!this.alertsService.assertPayloadType(alertType, payload)) {
      throw new BadRequestException(
        ERROR_MESSAGES.alertController.incorrectPayload,
      );
    }

    if (parsedMode === AlertDeliveryMode.MODAL) {
      const anotherAlert = await AlertModel.findOne({
        where: {
          alertType,
          deliveryMode: parsedMode,
          userId: targetUserId,
          resolved: IsNull(),
        },
      });

      if (anotherAlert) {
        throw new BadRequestException(
          ERROR_MESSAGES.alertController.duplicateAlert,
        );
      }
    }

    const alert = await AlertModel.create({
      alertType,
      deliveryMode: parsedMode,
      sent: new Date(),
      userId: targetUserId,
      courseId,
      payload,
    }).save();

    return alert;
  }

  @Patch(':alertId')
  @Roles(Role.STUDENT, Role.TA, Role.PROFESSOR)
  async closeAlert(
    @Param('alertId', ParseIntPipe) alertId: number,
  ): Promise<void> {
    const alert = await AlertModel.findOne({
      where: {
        id: alertId,
      },
    });

    if (!alert) {
      throw new BadRequestException(
        ERROR_MESSAGES.alertController.notActiveAlert,
      );
    }

    if (alert.deliveryMode === AlertDeliveryMode.FEED) {
      alert.readAt = new Date();
    } else {
      alert.resolved = new Date();
    }
    await alert.save();
  }
}
