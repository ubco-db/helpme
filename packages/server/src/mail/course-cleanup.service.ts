import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
import { SentEmailModel } from './sent-email.entity';
import { RedisProfileService } from '../redisProfile/redis-profile.service';
import { CourseService } from '../course/course.service';

@Injectable()
export class CourseCleanupService {
  constructor(
    private mailService: MailService,
    private redisProfileService: RedisProfileService,
    private courseService: CourseService,
  ) {}

 private testPhase = 0;

@Cron('* * * * *') // every minute
async runTestPhase(): Promise<void> {
  this.testPhase++;

  if (this.testPhase === 1) {
    console.log('[TEST] Phase 1: Warning email');
    await this.sendWarningEmails();
  } else if (this.testPhase === 2) {
    console.log('[TEST] Phase 2: Final warning email');
    await this.sendFinalWarningEmails();
  } else if (this.testPhase === 3) {
    console.log('[TEST] Phase 3: Archival');
    await this.archiveEndedCourses();
    this.testPhase = 0;
  }

}
@Cron('0 0 0 1 * *') // 1st of every month - initial warning emails
  async sendWarningEmails(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting warning email job…');

      const coursesToWarn = await this.getCoursesOnEndedSemesters();
      if (coursesToWarn.length === 0) {
        console.log('[CourseCleanup] No courses needing warning emails. Skipping.');
        return;
      }

      const professorCourseMap = await this.groupCoursesByProfessor(
        coursesToWarn.map((c) => c.id),
        coursesToWarn,
      );
      const archiveDate = new Date();
      archiveDate.setDate(15);
      const formattedArchiveDate = archiveDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {
        try {
          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.COURSE_CLEANUP_NOTIFICATION,
            subject: CourseCleanupEmailBuilder.buildNotificationSubject(courses, formattedArchiveDate),
            content: CourseCleanupEmailBuilder.buildNotificationEmail(courses, formattedArchiveDate),
            track: true,
            metadata: { courseIds: courses.map((c) => c.id), phase: 'warning' },
          });
          emailsSent++;
        } catch (error) {
          emailsFailed++;
          console.error(`[CourseCleanup] Failed to send warning email to professor ${professorId}:`, error);
          Sentry.captureException(error, { extra: { professorId, phase: 'warning' } });
        }
      }
    } catch (error) {
      console.error('[CourseCleanup] Fatal error in sendWarningEmails:', error);
      Sentry.captureException(error);
    }
  }

  @Cron('0 0 0 11 * *') // 11th of  month - final warning emails
  async sendFinalWarningEmails(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting final warning email job…');

      const coursesToWarn = await this.getCoursesOnEndedSemesters();
      if (coursesToWarn.length === 0) {
        console.log('[CourseCleanup] No courses needing final warning emails. Skipping.');
        return;
      }

      const professorCourseMap = await this.groupCoursesByProfessor(
        coursesToWarn.map((c) => c.id),
        coursesToWarn,
      );
      const archiveDate = new Date();
      archiveDate.setDate(15);
      const formattedArchiveDate = archiveDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let emailsSent = 0;
      let emailsFailed = 0;

      for (const [professorId, { professor, courses }] of professorCourseMap) {
        try {
          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.COURSE_CLEANUP_NOTIFICATION,
            subject: CourseCleanupEmailBuilder.buildFinalWarningSubject(courses),
            content: CourseCleanupEmailBuilder.buildFinalWarningEmail(courses, formattedArchiveDate),
            track: true,
            metadata: { courseIds: courses.map((c) => c.id), phase: 'final_warning' },
          });
          emailsSent++;
        } catch (error) {
          emailsFailed++;
          console.error(`[CourseCleanup] Failed to send final warning email to professor ${professorId}:`, error);
          Sentry.captureException(error, { extra: { professorId, phase: 'final_warning' } });
        }
      }

      console.log(`[CourseCleanup] Final warning emails complete. Sent ${emailsSent}, failed ${emailsFailed}.`);
    } catch (error) {
      console.error('[CourseCleanup] Fatal error in sendFinalWarningEmails:', error);
      Sentry.captureException(error);
    }
  }

  @Cron('0 0 0 15 * *') // 15th of month - archival (only for notified courses)
  async archiveEndedCourses(): Promise<void> {
    try {
      console.log('[CourseCleanup] Starting archival job…');

      const coursesToArchive = await this.getCoursesReadyForArchival();
      if (coursesToArchive.length === 0) {
        console.log('[CourseCleanup] No courses to archive. Skipping.');
        return;
      }

      const cleanupEmails = await SentEmailModel.find({
        where: { serviceType: MailServiceType.COURSE_CLEANUP_NOTIFICATION },
      });

      const notifiedCourseIds = new Set<number>();
      for (const email of cleanupEmails) {
        const courseIds = (email.metadata as { courseIds?: number[] })?.courseIds;
        if (courseIds) {
          for (const id of courseIds) notifiedCourseIds.add(id);
        }
      }

      const notifiedCourses = coursesToArchive.filter((c) => notifiedCourseIds.has(c.id));
      const skippedCourses = coursesToArchive.filter((c) => !notifiedCourseIds.has(c.id));

      if (skippedCourses.length > 0) {
        console.warn(
          `[CourseCleanup] Skipping ${skippedCourses.length} course(s) that were never notified: ${skippedCourses.map((c) => `${c.name} (ID: ${c.id})`).join(', ')}`,
        );
      }

      let archived = 0;
      let failed = 0;

      for (const course of notifiedCourses) {
        try {
          await this.archiveCourse(course);
          archived++;
        } catch (error) {
          failed++;
          console.error(`[CourseCleanup] Failed to archive course: ${course.name} (ID: ${course.id})`, error);
          Sentry.captureException(error, { extra: { courseId: course.id, courseName: course.name } });
        }
      }

      // Clean up tracked emails since archival is done
      if (cleanupEmails.length > 0) {
        await SentEmailModel.remove(cleanupEmails);
        console.log(`[CourseCleanup] Cleaned up ${cleanupEmails.length} tracked notification email(s).`);
      }

      console.log(`[CourseCleanup] Archival phase complete. Archived ${archived}, failed ${failed}, skipped ${skippedCourses.length} (not notified).`);
    } catch (error) {
      console.error('[CourseCleanup] Fatal error in archiveEndedCourses:', error);
      Sentry.captureException(error);
    }
  }

  private async getCoursesOnEndedSemesters(): Promise<CourseModel[]> {
    const now = new Date();
    const minDate = new Date('2023-01-01');

    return CourseModel.createQueryBuilder('course')
      .innerJoinAndSelect('course.semester', 'semester')
      .leftJoinAndSelect('course.lmsIntegration', 'lmsIntegration')
      .leftJoinAndSelect('lmsIntegration.orgIntegration', 'orgIntegration')
      .loadRelationCountAndMap('course.chatbotDocCount', 'course.chatbot_doc_pdfs')
      .where('course.deletedAt IS NULL')
      .andWhere('course.enabled = :enabled', { enabled: true })
      .andWhere('semester.endDate IS NOT NULL')
      .andWhere('semester.endDate < :now', { now })
      .andWhere('semester.endDate > :minDate', { minDate })
      .getMany();
  }

  private async getCoursesReadyForArchival(): Promise<CourseModel[]> {
    const minDate = new Date('2023-01-01');
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return CourseModel.createQueryBuilder('course')
      .innerJoinAndSelect('course.semester', 'semester')
      .leftJoinAndSelect('course.lmsIntegration', 'lmsIntegration')
      .leftJoinAndSelect('lmsIntegration.orgIntegration', 'orgIntegration')
      .loadRelationCountAndMap('course.chatbotDocCount', 'course.chatbot_doc_pdfs')
      .where('course.deletedAt IS NULL')
      .andWhere('course.enabled = :enabled', { enabled: true })
      .andWhere('semester.endDate IS NOT NULL')
      // .andWhere('semester.endDate < :twoWeeksAgo', { twoWeeksAgo })
      .andWhere('semester.endDate < :oneDayAgo', { oneDayAgo })
      .andWhere('semester.endDate > :minDate', { minDate })
      .getMany();
  }

  private async groupCoursesByProfessor(
    courseIds: number[],
    courses: CourseModel[],
  ): Promise<Map<number, { professor: { id: number; email: string }; courses: CourseModel[] }>> {
    const professorCourses = await UserCourseModel.createQueryBuilder('uc')
      .innerJoinAndSelect('uc.user', 'user')
      .where('uc.role = :role', { role: Role.PROFESSOR })
      .andWhere('uc.courseId IN (:...courseIds)', { courseIds })
      .getMany();

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const map = new Map<number, { professor: { id: number; email: string }; courses: CourseModel[] }>();

    for (const pc of professorCourses) {
      if (!pc.user?.email) continue;
      const course = courseMap.get(pc.courseId);
      if (!course) continue;

      if (!map.has(pc.user.id)) {
        map.set(pc.user.id, {
          professor: { id: pc.user.id, email: pc.user.email },
          courses: [],
        });
      }
      map.get(pc.user.id).courses.push(course);
    }

    return map;
  }

  private async isUnsubscribed(professorId: number, serviceType: MailServiceType): Promise<boolean> {
    try {
      const mailService = await MailServiceModel.findOne({ where: { serviceType } });
      if (!mailService) return false;

      const subscription = await UserSubscriptionModel.findOne({
        where: { userId: professorId, serviceId: mailService.id },
      });

      return subscription?.isSubscribed === false;
    } catch (error) {
      console.error(`[CourseCleanup] Error checking subscription for professor ${professorId}:`, error);
      return false;
    }
  }

  private async archiveCourse(course: CourseModel): Promise<void> {
    // Get users for cache invalidation
    const usersInCourse = await UserCourseModel.find({
      where: { courseId: course.id },
      select: { userId: true },
    });

    // Use CourseService to handle the actual archival with cleanup options
    await this.courseService.archiveCourse(course, {
      deleteChatbotDocs: true,
      deleteLMSIntegration: true,
      permanentlyDelete: true, 
    });

    // Clear user caches
    for (const userCourse of usersInCourse) {
      try {
        await this.redisProfileService.deleteProfile(`u:${userCourse.userId}`);
      } catch (error) {
        console.warn(`[CourseCleanup] Failed to clear cache for user ${userCourse.userId}:`, error);
      }
    }
  }
}