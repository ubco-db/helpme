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
import { CourseCleanupEmailBuilder } from './course-cleanup-email.builder';
import { RedisProfileService } from '../redisProfile/redis-profile.service';

@Injectable()
export class CourseCleanupService {
  constructor(
    private mailService: MailService,
    private redisProfileService: RedisProfileService,
  ) {}

 @Cron('0 0 0 1 * *')
 // @Cron(CronExpression.EVERY_MINUTE)
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

          const emailHtml = CourseCleanupEmailBuilder.buildNotificationEmail(
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

  @Cron('0 0 0 15 * *')
  // @Cron(CronExpression.EVERY_MINUTE)
  async archiveEndedCourses(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting archival job…');

      const coursesToArchive = await this.getCoursesReadyForArchival();
      console.log(`[CourseCleanup] Found ${coursesToArchive.length} courses ready for archival:`, coursesToArchive.map(c => ({ id: c.id, name: c.name, semesterEndDate: c.semester?.endDate })));

      if (coursesToArchive.length === 0) {
        console.log('[CourseCleanup] No courses to archive. Skipping.');
        return;
      }

      let archived = 0;
      let failed = 0;
      const successfullyArchivedCourses: CourseModel[] = [];

      for (const course of coursesToArchive) {
        try {
          console.log(`[CourseCleanup] Archiving course ${course.id} (${course.name}) - semester ended: ${course.semester?.endDate}`);
          await this.archiveCourse(course);
          archived++;
          successfullyArchivedCourses.push(course);
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

      // Send confirmation emails for successfully archived courses
      if (successfullyArchivedCourses.length > 0) {
        await this.sendArchivalConfirmationEmails(successfullyArchivedCourses);
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

  private async getCoursesReadyForArchival(): Promise<CourseModel[]> {
    const now = new Date();
    const minDate = new Date('2023-01-01');
    
    // Only archive courses that ended more than 2 weeks ago to ensure notification time
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    console.log(`[CourseCleanup] Archival criteria: courses ended before ${twoWeeksAgo.toISOString()} and after ${minDate.toISOString()}`);

    return CourseModel.createQueryBuilder('course')
      .innerJoinAndSelect('course.semester', 'semester')
      .where('course.deletedAt IS NULL')
      .andWhere('course.enabled = :enabled', { enabled: true })
      .andWhere('semester.endDate IS NOT NULL')
      .andWhere('semester.endDate < :twoWeeksAgo', { twoWeeksAgo })
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
  private async sendArchivalConfirmationEmails(
    archivedCourses: CourseModel[],
  ): Promise<void> {
    try {
      console.log(
        '[CourseCleanup] Sending archival confirmation emails…',
      );

      // Group courses by professor
      const professorCourseMap = await this.groupCoursesByProfessor(
        archivedCourses.map((c) => c.id),
      );

      // Calculate the warning date (1st of current month)
      const warningDate = new Date();
      warningDate.setDate(1);
      const formattedWarningDate = warningDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {
        try {
          if (await this.isUnsubscribed(professorId)) continue;

          const emailHtml = CourseCleanupEmailBuilder.buildConfirmationEmail(
            courses,
            formattedWarningDate,
          );

          const subject = courses.length === 1 
            ? `HelpMe: Course "${courses[0].name}" archived`
            : `HelpMe: ${courses.length} courses archived`;

          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.COURSE_CLEANUP_NOTIFICATION,
            subject,
            content: emailHtml,
          });

          emailsSent++;
        } catch (error) {
          emailsFailed++;
          console.error(
            `[CourseCleanup] Failed to send confirmation email to professor ${professorId}:`,
            error,
          );
          Sentry.captureException(error, {
            extra: { professorId, phase: 'confirmation' },
          });
        }
      }

      console.log(
        `[CourseCleanup] Confirmation emails complete. Sent ${emailsSent}, failed ${emailsFailed}.`,
      );
    } catch (error) {
      console.error(
        '[CourseCleanup] Fatal error in sendArchivalConfirmationEmails:',
        error,
      );
      Sentry.captureException(error);
    }
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
    const usersInCourse = await UserCourseModel.find({
      where: { courseId: course.id },
      select: ['userId'],
    });

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
    for (const userCourse of usersInCourse) {
      try {
        await this.redisProfileService.deleteProfile(`u:${userCourse.userId}`);
      } catch (error) {
        console.warn(
          `[CourseCleanup] Failed to clear cache for user ${userCourse.userId}:`,
          error,
        );
      }
    }

    console.log(
      `[CourseCleanup] Archived course ${course.id} (${course.name}) and cleared cache for ${usersInCourse.length} users.`,
    );
  }
}
