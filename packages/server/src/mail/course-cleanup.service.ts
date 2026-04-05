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

 @Cron('0 0 0 1 * *') // 1st of every month - warning emails
  async sendWarningEmails(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting cleanup notification job…');
      console.log('[CourseCleanup] Starting warning email job…');

      const coursesToWarn = await this.getCoursesNeedingWarningEmails();

      if (coursesToWarn.length === 0) {
        console.log(
          '[CourseCleanup] No courses needing warning emails. Skipping.',
        );
        return;
      }

      // Group courses by professor
      const professorCourseMap = await this.groupCoursesByProfessor(
        coursesToWarn.map((c) => c.id),
      );

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {
        try {
          if (await this.isUnsubscribed(professorId, MailServiceType.COURSE_CLEANUP_NOTIFICATION)) {
            continue;
          }
          const now = new Date();
          const archiveDate = new Date(now);
          archiveDate.setDate(now.getDate() + 14);

          const formattedDate = archiveDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          const emailHtml = CourseCleanupEmailBuilder.buildNotificationEmail(
            courses,
            formattedDate,
          );

          const subject = courses.length === 1 
            ? `HelpMe: Your course "${courses[0].name}" will be archived on ${formattedDate}`
            : `HelpMe: ${courses.length} of your courses will be archived on ${formattedDate}`;

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
            `[CourseCleanup] Failed to send warning email to professor ${professorId}:`,
            error,
          );
          Sentry.captureException(error, {
            extra: { professorId, phase: 'warning' },
          });
        }
      }
    } catch (error) {
      console.error(
        '[CourseCleanup] Fatal error in sendWarningEmails:',
        error,
      );
      Sentry.captureException(error);
    }
  }

@Cron('0 0 0 15 * *') // 15th of every month do the archival process and send the confirmation emails
async archiveEndedCourses(): Promise<void> {
  try {
    console.log('[CourseCleanup] Starting archival job…');
    const coursesToArchive = await this.getCoursesReadyForArchival();
    if (coursesToArchive.length === 0) {
      console.log('[CourseCleanup] No courses to archive. Skipping.');
      return;
    }
    const professorCourseMap = await this.groupCoursesByProfessor(
      coursesToArchive.map((c) => c.id),
    );

    let archived = 0;
    let failed = 0;
    const successfullyArchivedCourseIds = new Set<number>();

    for (const course of coursesToArchive) {
      try {
        await this.archiveCourse(course);
        archived++;
        successfullyArchivedCourseIds.add(course.id);
      } catch (error) {
        failed++;
        console.error(`[CourseCleanup] Failed to archive course: ${course.name} (ID: ${course.id})`, error);
        Sentry.captureException(error, {
          extra: { courseId: course.id, courseName: course.name },
        });
      }
    }

    console.log(`[CourseCleanup] Archival phase complete. Archived ${archived}, failed ${failed}.`);

    if (successfullyArchivedCourseIds.size > 0) {
      await this.sendArchivalConfirmationEmails(
        successfullyArchivedCourseIds,
        professorCourseMap,
      );
    }
  } catch (error) {
    console.error('[CourseCleanup] Fatal error in archiveEndedCourses:', error);
    Sentry.captureException(error);
  }
}

  private async getCoursesNeedingWarningEmails(): Promise<CourseModel[]> {
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
      
      if (!pc.user?.email) {
        continue;
      }
      
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
  // Send confirmation emails after archival 
  private async sendArchivalConfirmationEmails(
    successfulCourseIds: Set<number>,
    professorCourseMap: Map<number, { professor: { id: number; email: string }; courses: CourseModel[] }>,
  ): Promise<void> {
    try {      
      let emailsSent = 0;
      let emailsFailed = 0;
      let professorsSkipped = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {        
        const archivedCourses = courses.filter((c) => successfulCourseIds.has(c.id));
        
        if (archivedCourses.length === 0) {
          continue;
        }

        try {
          const isUnsubscribed = await this.isUnsubscribed(professorId, MailServiceType.COURSE_CLEANUP_CONFIRMATION);          
          if (isUnsubscribed) {
            professorsSkipped++;
            continue;
          }

          // Use today's date for the confirmation email (when archival actually happened)
          const today = new Date();
          const formattedToday = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const emailHtml = CourseCleanupEmailBuilder.buildConfirmationEmail(
            archivedCourses,
            formattedToday,
          );
          const subject = archivedCourses.length === 1
            ? `HelpMe: Course "${archivedCourses[0].name}" has been archived`
            : `HelpMe: ${archivedCourses.length} courses have been archived`;
          
          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.COURSE_CLEANUP_CONFIRMATION,
            subject,
            content: emailHtml,
          });
          emailsSent++;
        } catch (error) {
          emailsFailed++;
          console.error(
            `[CourseCleanup] Failed to send confirmation email to professor ${professorId} (${professor.email}):`,
            error,
          );
          Sentry.captureException(error, { 
            extra: { professorId, professorEmail: professor.email, phase: 'confirmation', archivedCourses: archivedCourses.map(c => ({ id: c.id, name: c.name })) } 
          });
        }
      }
      console.log(`[CourseCleanup] Confirmation emails complete. Sent ${emailsSent}, failed ${emailsFailed}, skipped ${professorsSkipped}.`);
    } catch (error) {
      console.error('[CourseCleanup] Fatal error in sendArchivalConfirmationEmails:', error);
      Sentry.captureException(error);
    }
  }

  private async isUnsubscribed(professorId: number, serviceType: MailServiceType): Promise<boolean> {
    try {
      const mailService = await MailServiceModel.findOne({
        where: { serviceType },
      });
      
      if (!mailService) {
        return false;
      }

      const subscription = await UserSubscriptionModel.findOne({
        where: { userId: professorId, serviceId: mailService.id },
      });

      return subscription?.isSubscribed === false;
    } catch (error) {
      console.error(
        error,
      );
      return false;
    }
  }
  private async archiveCourse(course: CourseModel): Promise<void> {
    const usersInCourse = await UserCourseModel.find({
      where: { courseId: course.id },
      select: { userId: true },
    });

    await ChatbotDocPdfModel.delete({
      courseId: course.id,
    });

    await LMSCourseIntegrationModel.delete({
      courseId: course.id,
    });

    await CourseModel.softRemove(course);
    // Clear Redis cache for all users who were in this course
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
  }
}
