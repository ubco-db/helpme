import {
  AlertDeliveryMode,
  AlertType,
  CreateAlertParams,
  CreateAlertResponse,
  ERROR_MESSAGES,
  GetAlertsResponse,
  Role,
  FEED_ALERT_TYPES,
  MODAL_ALERT_TYPES,
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
  ParseBoolPipe,
  ParseEnumPipe,
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

  @Patch('mark-read-bulk')
  async markReadBulk(
    @UserId() userId: number,
    @Body('alertIds') alertIds: number[],
  ): Promise<void> {
    if (!Array.isArray(alertIds) || alertIds.length === 0) return;
    await AlertModel.createQueryBuilder()
      .update(AlertModel)
      .set({ readAt: () => 'NOW()' })
      .where('id IN (:...ids)', { ids: alertIds })
      .andWhere('userId = :userId', { userId })
      .andWhere('deliveryMode = :mode', { mode: AlertDeliveryMode.FEED })
      .execute();
  }

  // Mark all unread FEED alerts for current user as read
  @Patch('mark-read-all')
  async markReadAll(@UserId() userId: number): Promise<void> {
    console.log('Marking all feed alerts as read for user', userId);
    await AlertModel.createQueryBuilder()
      .update(AlertModel)
      .set({ readAt: () => 'NOW()' })
      .where('userId = :userId', { userId })
      .andWhere('deliveryMode = :mode', { mode: AlertDeliveryMode.FEED })
      .andWhere('readAt IS NULL')
      .execute();
  }

  @Get()
  async getAllAlerts(
    @UserId() userId: number,
    @Query('mode', new ParseEnumPipe(AlertDeliveryMode))
    mode: AlertDeliveryMode = AlertDeliveryMode.FEED,
    @Query('includeRead', ParseBoolPipe) includeRead = true,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ): Promise<GetAlertsResponse> {
    const where: Record<string, unknown> = {
      userId,
      deliveryMode: mode,
    };

    if (mode === AlertDeliveryMode.MODAL) {
      where.resolved = IsNull();
    } else if (!includeRead) {
      where.readAt = IsNull();
    }

    const total = await AlertModel.count({ where });
    const alerts = await AlertModel.find({
      where,
      order: { readAt: 'ASC', sent: 'DESC' },
      take: Math.max(1, Math.min(limit, 100)),
      skip: Math.max(0, offset),
    });
    return {
      alerts: await this.alertsService.removeStaleAlerts(alerts),
      total,
    };
  }

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

    const total = await AlertModel.count({ where });
    const alerts = await AlertModel.find({
      where,
      order: { sent: 'DESC' },
    });
    return {
      alerts: await this.alertsService.removeStaleAlerts(alerts),
      total,
    };
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

    // Enforce allowed alert types per delivery mode
    if (
      (parsedMode === AlertDeliveryMode.FEED &&
        !FEED_ALERT_TYPES.includes(alertType)) ||
      (parsedMode === AlertDeliveryMode.MODAL &&
        !MODAL_ALERT_TYPES.includes(alertType))
    ) {
      throw new BadRequestException(
        'Invalid alert type for selected delivery mode',
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
