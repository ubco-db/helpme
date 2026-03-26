import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from './mail.service';
import { MailServiceType, Role } from '@koh/common';
import * as Sentry from '@sentry/nestjs';
import { UserCourseModel } from '../profile/user-course.entity';
import { CourseModel } from '../course/course.entity';
import { ChatbotDocPdfModel } from '../chatbot/chatbot-doc-pdf.entity';
import { LMSCourseIntegrationModel } from '../lmsIntegration/lmsCourseIntegration.entity';
import { UserSubscriptionModel } from './user-subscriptions.entity';
import { MailServiceModel } from './mail-services.entity';

@Injectable()
export class CourseCleanupService {
  constructor(private mailService: MailService) {}

 // @Cron('0 0 0 1 * *')
 @Cron(CronExpression.EVERY_MINUTE)
  async sendCleanupNotifications(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting cleanup notification job…');

      const coursesToNotify = await this.getCoursesOnEndedSemesters();

      if (coursesToNotify.length === 0) {
        console.log(
          '[CourseCleanup] No courses on ended semesters found. Skipping.',
        );
        return;
      }

      // Group courses by professor
      const professorCourseMap = await this.groupCoursesByProfessor(
        coursesToNotify.map((c) => c.id),
      );

      const archiveDate = new Date();
      archiveDate.setDate(15); // 15th of the current month

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {
        try {
          if (await this.isUnsubscribed(professorId)) continue;

          const courseLinks = courses
            .map(
              (c) =>
                `<a href="${process.env.DOMAIN}/course/${c.id}/settings" style="color: #1a73e8; text-decoration: underline;">${c.name}</a>`,
            )
            .join(', ');

          const formattedDate = archiveDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          const emailHtml = this.buildNotificationEmail(
            courses,
            formattedDate,
          );

          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.COURSE_CLEANUP_NOTIFICATION,
            subject: `HelpMe: ${courses.length === 1 ? `Your course "${courses[0].name}"` : `${courses.length} of your courses`} will be archived on ${formattedDate}`,
            content: emailHtml,
          });

          emailsSent++;
        } catch (error) {
          emailsFailed++;
          console.error(
            `[CourseCleanup] Failed to send notification to professor ${professorId}:`,
            error,
          );
          Sentry.captureException(error, {
            extra: { professorId, phase: 'notification' },
          });
        }
      }

      console.log(
        `[CourseCleanup] Notification phase complete. Sent ${emailsSent}, failed ${emailsFailed}.`,
      );
    } catch (error) {
      console.error(
        '[CourseCleanup] Fatal error in sendCleanupNotifications:',
        error,
      );
      Sentry.captureException(error);
    }
  }

  //@Cron('0 0 0 15 * *')
  @Cron(CronExpression.EVERY_MINUTE)
  async archiveEndedCourses(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting archival job…');

      const coursesToArchive = await this.getCoursesOnEndedSemesters();

      if (coursesToArchive.length === 0) {
        console.log('[CourseCleanup] No courses to archive. Skipping.');
        return;
      }

      let archived = 0;
      let failed = 0;

      for (const course of coursesToArchive) {
        try {
          await this.archiveCourse(course);
          archived++;
        } catch (error) {
          failed++;
          console.error(
            `[CourseCleanup] Failed to archive course ${course.id} (${course.name}):`,
            error,
          );
          Sentry.captureException(error, {
            extra: { courseId: course.id, courseName: course.name },
          });
        }
      }

      console.log(
        `[CourseCleanup] Archival phase complete. Archived ${archived}, failed ${failed}.`,
      );
    } catch (error) {
      console.error(
        '[CourseCleanup] Fatal error in archiveEndedCourses:',
        error,
      );
      Sentry.captureException(error);
    }
  }
  private async getCoursesOnEndedSemesters(): Promise<CourseModel[]> {
    const now = new Date();
    const minDate = new Date('2023-01-01');

    return CourseModel.createQueryBuilder('course')
      .innerJoinAndSelect('course.semester', 'semester')
      .where('course.deletedAt IS NULL')
      .andWhere('course.enabled = :enabled', { enabled: true })
      .andWhere('semester.endDate IS NOT NULL')
      .andWhere('semester.endDate < :now', { now })
      .andWhere('semester.endDate > :minDate', { minDate })
      .getMany();
  }

  private async groupCoursesByProfessor(
    courseIds: number[],
  ): Promise<
    Map<
      number,
      { professor: { id: number; email: string }; courses: CourseModel[] }
    >
  > {
    const professorCourses = await UserCourseModel.createQueryBuilder('uc')
      .innerJoinAndSelect('uc.user', 'user')
      .innerJoinAndSelect('uc.course', 'course')
      .where('uc.role = :role', { role: Role.PROFESSOR })
      .andWhere('uc.courseId IN (:...courseIds)', { courseIds })
      .getMany();

    const map = new Map<
      number,
      { professor: { id: number; email: string }; courses: CourseModel[] }
    >();

    for (const pc of professorCourses) {
      if (!pc.user?.email) continue;
      if (!map.has(pc.user.id)) {
        map.set(pc.user.id, {
          professor: { id: pc.user.id, email: pc.user.email },
          courses: [],
        });
      }
      map.get(pc.user.id).courses.push(pc.course);
    }

    return map;
  }
  private async isUnsubscribed(professorId: number): Promise<boolean> {
    const mailService = await MailServiceModel.findOne({
      where: { serviceType: MailServiceType.COURSE_CLEANUP_NOTIFICATION },
    });
    if (!mailService) return false;

    const subscription = await UserSubscriptionModel.findOne({
      where: { userId: professorId, serviceId: mailService.id },
    });

    return subscription?.isSubscribed === false;
  }
  private async archiveCourse(course: CourseModel): Promise<void> {
    const deletedDocs = await ChatbotDocPdfModel.delete({
      courseId: course.id,
    });
    console.log(
      `[CourseCleanup] Deleted ${deletedDocs.affected ?? 0} chatbot document(s) for course ${course.id}.`,
    );

    const deletedLms = await LMSCourseIntegrationModel.delete({
      courseId: course.id,
    });
    if (deletedLms.affected > 0) {
      console.log(
        `[CourseCleanup] Severed LMS integration for course ${course.id}.`,
      );
    }

    await CourseModel.softRemove(course);
    console.log(
      `[CourseCleanup] Archived course ${course.id} (${course.name}).`,
    );
  }
  private buildNotificationEmail(
    courses: CourseModel[],
    archiveDateStr: string,
  ): string {
    const courseListHtml = courses
      .map(
        (c) =>
          `<li style="margin-bottom: 6px;">
            <a href="${process.env.DOMAIN}/course/${c.id}/settings" style="color: #1a73e8; text-decoration: underline; font-weight: 600;">${c.name}</a>
            ${c.semester ? ` <span style="color: #888;">(${c.semester.name})</span>` : ''}
          </li>`,
      )
      .join('');

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #1a73e8, #174ea6); padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Course Cleanup Notice</h1>
        </div>

        <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 15px; line-height: 1.6;">
            The following course${courses.length > 1 ? 's are' : ' is'} assigned to a semester that has ended and will be <strong>automatically archived on ${archiveDateStr}</strong>:
          </p>

          <ul style="padding-left: 20px; margin: 16px 0;">
            ${courseListHtml}
          </ul>

          <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
            <strong style="color: #856404;">On the archive date, the following will happen automatically:</strong>
            <ul style="margin-top: 8px; padding-left: 18px; color: #856404;">
              <li>All uploaded chatbot documents will be deleted (to save server space — chatbot questions are still saved)</li>
              <li>Any data downloaded from Canvas will be removed</li>
              <li>The Canvas/LMS integration will be severed</li>
              <li>The course will be marked as archived</li>
            </ul>
          </div>

          <p style="font-size: 15px; line-height: 1.6;">
            <strong>To prevent this</strong>, simply re-assign the course to a semester that has not yet ended before ${archiveDateStr}.
          </p>

          <p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
            This is an automated cleanup process. If this course has ended and is not being used anymore, you can safely disregard this email.
          </p>
        </div>
      </div>
    `;
  }
}
