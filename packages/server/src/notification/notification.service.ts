import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeepPartial } from 'typeorm';
import * as webPush from 'web-push';
import { UserModel } from '../profile/user.entity';
import { DesktopNotifModel } from './desktop-notif.entity';
import * as fs from 'fs';
import { isProd } from '@koh/common';
export const NotifMsgs = {
  queue: {
    ALERT_BUTTON:
      "The TA could't reach you, please be ready and confirm you are back!",
    THIRD_PLACE: `You're 3rd in the queue. Be ready for a TA to call you soon!`,
    TA_HIT_HELPED: (taName: string): string =>
      `${taName} is ready for you now!`,
    PAUSED: (taName: string): string =>
      `${taName} has paused your question for the time being.`,
    REMOVED: `You've been removed from the queue. Please return to the app for more information.`,
  },
  ta: {
    STUDENT_JOINED_EMPTY_QUEUE:
      'A student has joined your (previously empty) queue!',
  },
};

//TODO test this service omg
@Injectable()
export class NotificationService {
  desktopPublicKey: string;

  constructor(private configService: ConfigService) {
    webPush.setVapidDetails(
      this.configService.get('EMAIL'),
      this.configService.get('PUBLICKEY'),
      this.configService.get('PRIVATEKEY'),
    );
    this.desktopPublicKey = this.configService.get('PUBLICKEY');
  }

  async registerDesktop(
    info: DeepPartial<DesktopNotifModel>,
  ): Promise<DesktopNotifModel> {
    // create if not exist
    let dn = await DesktopNotifModel.findOne({
      where: { userId: info.userId, endpoint: info.endpoint },
    });
    if (!dn) {
      dn = await DesktopNotifModel.create(info).save();
    }
    return dn;
  }

  // Notify user on all platforms
  async notifyUser(userId: number, message: string): Promise<void> {
    const notifModelsOfUser = await UserModel.findOne({
      where: {
        id: userId,
      },
      relations: {
        desktopNotifs: true,
      },
    });

    // run the promises concurrently
    if (notifModelsOfUser.desktopNotifsEnabled) {
      await Promise.all(
        notifModelsOfUser.desktopNotifs.map(async (nm) =>
          this.notifyDesktop(nm, message),
        ),
      );
    }
  }

  // notifies a user via desktop notification
  async notifyDesktop(nm: DesktopNotifModel, message: string): Promise<void> {
    try {
      if (!isProd()) {
        await this.writeDesktopNotificationToFile(nm, message);
        return;
      }
      await webPush.sendNotification(
        {
          endpoint: nm.endpoint,
          keys: {
            p256dh: nm.p256dh,
            auth: nm.auth,
          },
        },
        message,
      );
    } catch (error) {
      console.error('Error sending desktop notification:', error);
      await DesktopNotifModel.remove(nm);
    }
  }

  /* Used for testing purposes. Allows you to write a desktop notification to a file instead of sending a real notification */
  async writeDesktopNotificationToFile(
    nm: DesktopNotifModel,
    message: string,
  ): Promise<void> {
    const logFile = './src/notification/desktop_notifications.log';
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`
      New desktop notification. Sent at ${new Date().toISOString()}
      message: ${message}
      endpoint: ${nm.endpoint}
      p256dh: ${nm.p256dh}
      auth: ${nm.auth}
      \n\n`);
    logStream.end();
    console.log(
      `Desktop notification written to desktop_notifications.log inside /server/src/notification/desktop_notifications.log`,
      message,
    );
  }
}
