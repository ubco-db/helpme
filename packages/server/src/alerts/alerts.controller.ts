import {
  AlertDeliveryMode,
  AlertType,
  CreateAlertParams,
  CreateAlertResponse,
  ERROR_MESSAGES,
  GetPageOfFeedAlerts,
  Role,
  FEED_ALERT_TYPES,
  MODAL_ALERT_TYPES,
  GetInitialAlertsResponse,
  Alert,
  CreateAlertAdminRequest,
  UserRole,
  MailServiceType,
  GetAdminNoticeAlert,
  CreateAlertAdminResponse,
  DeleteAdminNoticeRequest,
  DeleteAdminNoticeResponse,
} from '@koh/common';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt-auth.guard';
import { User, UserId } from 'decorators/user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AlertModel } from './alerts.entity';
import { AlertsService, formatAlertForFrontend } from './alerts.service';
import { EmailVerifiedGuard } from 'guards/email-verified.guard';
import { DataSource, IsNull } from 'typeorm';
import { Response } from 'express';
import { AlertsSSEService } from './alerts-sse.service';
import { CourseRolesGuard } from 'guards/course-roles.guard';
import { AdminRoleGuard } from 'guards/admin-role.guard';
import { UserModel } from '../profile/user.entity';
import { MailService } from 'mail/mail.service';

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
    private mailService: MailService,
    private dataSource: DataSource,
  ) {}

  // Mark all unread FEED alerts for current user as read
  @Patch('mark-read-all-feed')
  async markReadAllFeed(@UserId() userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const alertsToUpdate = await manager.find(AlertModel, {
        relations: { course: true },
        where: {
          userId,
          deliveryMode: AlertDeliveryMode.FEED,
          readAt: IsNull(),
        },
      });

      if (alertsToUpdate.length === 0) return [];

      const ids = alertsToUpdate.map((a) => a.id);
      await manager.update(AlertModel, ids, { readAt: new Date() });

      // await this.alertsSSEService.notifyUserOfUpdatedAlerts(alertsToUpdate); // done in alerts.subscriber instead
    });
  }

  /*
    used for fetching subsequent pages of FEED alerts after the initial getMyInitialAlerts fetch.
    Gets both read and unread notifications.

    What happens when totalAlerts doesn't match the current frontend total of unread alerts + readAt alerts?
    Who knows, probably the frontend messed up somewhere.
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
        totalFeedAlerts: totalFeedAlerts,
      };
    });
    return response;
  }

  /*
  - When page first loads, do query that fetches:
	- FEED alerts
    - Limit 100 alerts, choosing unread first, then by sentAt
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
      const modalAlertModels = await this.alertsService.getModalAlerts(
        userId,
        manager,
        courseId,
      );

      const [feedAlertModels, totalFeedAlerts] =
        await this.alertsService.getFeedAlerts(
          userId,
          manager,
          100,
          0,
          'all',
          courseId,
        );
      response = {
        mostAlerts: await this.alertsService.removeStaleAlerts(
          [...modalAlertModels, ...feedAlertModels],
          manager,
        ),
        totalFeedAlerts,
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
  @Get('alerts-sse')
  subscribeToSSE(@UserId() userId: number, @Res() res: Response): void {
    // returns AlertServerSentEvent
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

  @Post('create-alert/:courseId')
  @UseGuards(CourseRolesGuard)
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
        !(FEED_ALERT_TYPES as readonly AlertType[]).includes(alertType)) ||
      (parsedMode === AlertDeliveryMode.MODAL &&
        !(MODAL_ALERT_TYPES as readonly AlertType[]).includes(alertType))
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
  ): Promise<Alert> {
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
    return formatAlertForFrontend(alert);
  }

  @Post('admin-notice')
  @UseGuards(AdminRoleGuard)
  async createAdminNotice(
    @Body() body: CreateAlertAdminRequest,
    @User() user: UserModel,
  ): Promise<CreateAlertAdminResponse> {
    // we don't trust that request's given creatorName and creatorId, we'll set that ourselves
    body.payload.creatorName = user.name;
    body.payload.creatorId = user.id;
    const target = body.payload.target;
    return await this.dataSource.transaction(async (manager) => {
      // Figure out who we are creating alerts for based on the target
      const targetUserIds = await this.alertsService.getTargetUserIds(
        target,
        manager,
      );
      if (targetUserIds.length === 0)
        return {
          numSent: 0,
          sentAt: new Date(),
        };

      if (targetUserIds.length > 1000) {
        // mail admins that a big notification went out
        const adminUsers = await UserModel.find({
          where: {
            userRole: UserRole.ADMIN,
          },
        });
        await this.mailService.sendEmail({
          receiverOrReceivers: adminUsers.map((user) => user.email),
          subject: `HelpMe Admin: Big Notice Created (${targetUserIds.length} users)`,
          type: MailServiceType.ADMIN_NOTICE,
          content: `
          <p>${user.name} (${user.email}) created an Admin Notice alert that affected ${targetUserIds.length} users with the following message: </p>
          <p>${body.payload.message}</p>
          <p><b>If the person sending this and the contents look normal, please disregard this message.</b> Otherwise, someone should probably remove this person's admin perms (needs a DB query since admins can't have their perms revoked through the UI).</p>
          <p>More details:</p>
          <p>Target: ${!target ? 'Every single user' : JSON.stringify(target)}</p>
          <p>Delivery Mode: ${body.deliveryMode}</p>
          `,
        });
      }

      // bulk insert an alert for each targeted user
      const alertValues = targetUserIds.map((targetUserId) => ({
        alertType: AlertType.ADMIN_NOTICE,
        deliveryMode: body.deliveryMode,
        userId: targetUserId,
        courseId: body.payload.target?.courseId || null,
        payload: body.payload,
      }));

      const insertResult = await manager
        .createQueryBuilder()
        .insert() // note that this automatically gets pushed to everyone via alerts.subscriber (SSE)
        .into(AlertModel)
        .values(alertValues)
        .execute();
      const totalSentAlerts: number = insertResult.raw.length;
      // We need the exact sentAt to update the frontend state so it has the correct
      // timestamp. The frontend needs this since we delete alerts via their sentAt (this is the easiest way)
      const sentAt: Date = new Date(insertResult.raw[0].sentAt);
      return {
        numSent: totalSentAlerts,
        sentAt: sentAt,
      };
    });
  }

  @Get('admin-notice')
  @UseGuards(AdminRoleGuard)
  async getExistingAdminNoticeAlerts(): Promise<GetAdminNoticeAlert[]> {
    const rawResults = await AlertModel.createQueryBuilder('alert')
      .select('alert.sentAt', 'sentAt')
      .addSelect('alert.deliveryMode', 'deliveryMode')
      .addSelect('alert.payload::text', 'payload')
      .addSelect('COUNT(*)', 'totalSent')
      .addSelect(
        `COUNT(*) FILTER (WHERE alert."readAt" IS NOT NULL)`,
        'totalRead',
      ) // neat postgres trick, nicer than needing to use CASE WHEN
      .where('alert.alertType = :alertType', {
        alertType: AlertType.ADMIN_NOTICE,
      })
      .groupBy('alert.sentAt')
      .addGroupBy('alert.deliveryMode')
      .addGroupBy('alert.payload::text')
      .orderBy('alert.sentAt', 'DESC')
      .getRawMany();

    return rawResults.map((row) => {
      const payload =
        typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      return {
        sentAt: row.sentAt,
        deliveryMode: row.deliveryMode,
        title: payload.title ?? 'Admin Notice',
        message: payload.message,
        creatorName: payload.creatorName,
        creatorId: payload.creatorId,
        target: payload.target ?? undefined,
        totalSent: parseInt(row.totalSent, 10),
        totalRead: parseInt(row.totalRead, 10),
      };
    });
  }

  @Delete('admin-notice')
  @UseGuards(AdminRoleGuard)
  async deleteAdminNoticeAlerts(
    @Query() query: DeleteAdminNoticeRequest,
  ): Promise<DeleteAdminNoticeResponse> {
    // Apparently postgres datetimestamps have microsecond precision (js Date only have ms precision)
    // So we need to truncate to ms precision for the comparison
    const result = await AlertModel.createQueryBuilder()
      .delete()
      .from(AlertModel)
      .where('"alertType" = :alertType', { alertType: AlertType.ADMIN_NOTICE })
      .andWhere('date_trunc(\'milliseconds\', "sentAt") = :sentAt', {
        sentAt: query.sentAt,
      })
      .execute();
    return { numDeleted: result.affected ?? 0 };
  }
}
