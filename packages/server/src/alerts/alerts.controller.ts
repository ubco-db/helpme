import {
  AlertDeliveryMode,
  CreateAlertParams,
  CreateAlertResponse,
  ERROR_MESSAGES,
  GetPageOfFeedAlerts,
  Role,
  FEED_ALERT_TYPES,
  MODAL_ALERT_TYPES,
  AlertQueryMode,
  GetInitialAlertsResponse,
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
  NotFoundException,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { UserId } from 'decorators/user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AlertModel } from './alerts.entity';
import { AlertsService } from './alerts.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { DataSource, IsNull } from 'typeorm';
import { Response } from 'express';
import { AlertsSSEService } from './alerts-sse.service';

/*
Differences between the two types of notifications:
    FEED
      - Paginated (page size of like 5). For this reason we're using useSWRInfinite
      - Needs to also fetch already-read alerts to hide in the frontend and show on click (hence why pagination is necessary).
      - When on `(dashboard)` level, includes both alerts with a courseId and alerts without a courseId
    MODAL
      - Number of them is very small, so no pagination necessary
      - Should NOT include already-read alerts
      - When on `(dashboard)` level, needs to ONLY include alerts WITHOUT a courseId (that way, users won't get bombarded with "you should rephrase your question" etc. when they are in a different course entirely)
  */
@Controller('alerts')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class AlertsController {
  constructor(
    private alertsService: AlertsService,
    private alertsSSEService: AlertsSSEService,
    private dataSource: DataSource,
  ) {}

  // Mark all unread FEED alerts for current user as read
  @Patch('mark-read-all-feed')
  async markReadAllFeed(@UserId() userId: number): Promise<void> {
    await AlertModel.update(
      {
        userId,
        deliveryMode: AlertDeliveryMode.FEED,
        readAt: IsNull(),
      },
      { readAt: new Date() },
    );
  }

  /*
    used for fetching subsequent pages of FEED alerts after the initial getMyInitialAlerts fetch.
    Gets both read and unread notifications.

    What happens when totalAlerts doesn't match the current frontend total of unread alerts + readAt alerts?
    Who knows.
  */
  @Get('/feed')
  async getMyFeedAlerts(
    @UserId() userId: number,
    @Query('courseId', new ParseIntPipe()) courseId: number = -1,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ): Promise<GetPageOfFeedAlerts> {
    let response: GetPageOfFeedAlerts;
    await this.dataSource.transaction(async (manager) => {
      const [feedAlertModels, totalFeedAlerts] =
        await this.alertsService.getFeedAlerts(
          userId,
          manager,
          limit,
          offset,
          'all',
          courseId,
        );
      response = {
        pageOfFeedAlerts:
          await this.alertsService.removeStaleAlerts(feedAlertModels),
        totalAlerts: totalFeedAlerts,
      };
    });
    return response;
  }

  /*
  - When page first loads, do query that fetches:
	- FEED alerts
		- ALL unread alerts (limit 100, note that the nextPage() getter should still work with unreadAlerts).
		- Maybe 20 or so readAt alerts
		- When given no courseId: Fetch alerts across ALL courses
		- When given courseId: Fetch alerts with both null courseId and the courseId
	- MODAL alerts
		- ALL unread alerts (limit 20 since when would you ever have more than like 2 tbh)
		- When given no courseId: Fetch alerts ONLY with null courseId
		- When given courseId: same as FEED 
  */
  @Get('/initial')
  async getMyInitialAlerts(
    @UserId() userId: number,
    @Query('courseId', new ParseIntPipe()) courseId: number = -1,
  ): Promise<GetInitialAlertsResponse> {
    let response: GetInitialAlertsResponse = null;
    await this.dataSource.transaction(async (manager) => {
      const modalAlerts = await this.alertsService.removeStaleAlerts(
        await this.alertsService.getModalAlerts(userId, manager, courseId),
        manager,
      );
      const [unreadFeedAlertModels, totalUnreadFeedAlerts] =
        await this.alertsService.getFeedAlerts(
          userId,
          manager,
          100,
          0,
          'unread',
          courseId,
        );
      const [readAtFeedAlertModels, totalReadAtFeedAlerts] =
        await this.alertsService.getFeedAlerts(
          userId,
          manager,
          20,
          0,
          'dismissed',
          courseId,
        );
      response = {
        unreadModalAlerts: modalAlerts,
        someReadAtFeedAlerts: await this.alertsService.removeStaleAlerts(
          readAtFeedAlertModels,
          manager,
        ),
        totalReadAtFeedAlerts,
        totalUnreadFeedAlerts,
        unreadFeedAlerts: await this.alertsService.removeStaleAlerts(
          unreadFeedAlertModels,
          manager,
        ),
      };
    });
    return response;
  }

  /**
   * Endpoint that's called with a browser EventSource, which will create a new request
   * that expects a text/event-stream, allowing the server to keep sending data the browser.
   *
   * Server-Sent Events are basically like a 1-way server -> browser websocket.
   */
  @Get('sse')
  subscribeToSSE(@UserId() userId: number, @Res() res: Response): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    try {
      // This will basically store this `res` object into an array, and then subscribes the client using Redis' pub/sub system.
      // When a server event happens elsewhere (such as when an alert is created), it can send a message with sendEvent()
      // which will go through the array of `res` objects and do `res.write(data)` to each subscribed client of them.
      // I believe redis is only used as a scalability thing, so if there's multiple HelpMe instances they can each listen to the same
      // redis server and it will still work.
      // Also, technically returns a stream of "AlertServerSentEvent"
      this.alertsSSEService.subscribeClientToSSE(userId, res);
    } catch (err) {
      console.error(err);
    }
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
          readAt: IsNull(),
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
      userId: targetUserId,
      courseId,
      payload,
    }).save();

    return alert;
  }

  @Patch(':alertId')
  async closeAlert(
    @UserId() userId: number,
    @Param('alertId', ParseIntPipe) alertId: number,
  ): Promise<void> {
    const alert = await AlertModel.findOne({
      where: {
        id: alertId,
        userId: userId,
      },
    });

    if (!alert) {
      throw new NotFoundException(
        ERROR_MESSAGES.alertController.notActiveAlert,
      );
    }

    alert.readAt = new Date();
    await alert.save();
  }
}
