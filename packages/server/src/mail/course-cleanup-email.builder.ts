import { CourseModel } from '../course/course.entity';
import * as cheerio from 'cheerio';

function validateHtml(html: string): void {
  const closingTags = html.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  const $ = cheerio.load(html, { xmlMode: false }, false);
  const serialized = $.html();
  const serializedClosingTags = serialized.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  const difference = serializedClosingTags.length - closingTags.length;
  if (closingTags.length !== serializedClosingTags.length) {
    throw new Error(
      difference > 0
        ? `Invalid HTML: You have ${difference} unclosed tag(s).`
        : `Invalid HTML: You have ${Math.abs(difference)} orphaned closing tag(s) without opening tags.`,
    );
  }
  if (Math.abs(serialized.length - html.length) > Math.max(100, html.length * 0.05)) {
    throw new Error(`Invalid HTML: Structure significantly modified after parsing.`);
  }
}

export class CourseCleanupEmailBuilder {
  static readonly WARNING_CRON = '0 0 0 1 * *';        // 1st of every month
  static readonly FINAL_WARNING_CRON = '0 0 0 11 * *';  // 11th of every month
  static readonly ARCHIVAL_CRON = '0 0 0 15 * *';       // 15th of every month

  static buildNotificationSubject(courses: CourseModel[], archiveDateStr: string): string {
    return courses.length === 1
      ? `HelpMe: Your course "${courses[0].name}" will be archived on ${archiveDateStr}`
      : `HelpMe: ${courses.length} of your courses will be archived on ${archiveDateStr}`;
  }

  static buildFinalWarningSubject(courses: CourseModel[]): string {
    return courses.length === 1
      ? `FINAL NOTICE: Course "${courses[0].name}" will be archived in 4 days`
      : `FINAL NOTICE: ${courses.length} courses will be archived in 4 days`;
  }

  static buildNotificationEmail(courses: CourseModel[], archiveDateStr: string): string {
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        ${this.buildHeader()}
        ${this.buildNotificationContent(courses, archiveDateStr)}
      </div>
    `;
    validateHtml(emailBody);
    return emailBody;
  }

  static buildFinalWarningEmail(courses: CourseModel[], archiveDateStr: string): string {
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        ${this.buildFinalWarningHeader()}
        ${this.buildFinalWarningContent(courses, archiveDateStr)}
      </div>
    `;
    validateHtml(emailBody);
    return emailBody;
  }


  private static buildHeader(): string {
    return `
      <div style="background: linear-gradient(135deg, #1a73e8, #174ea6); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">WARNING: Course Cleanup Notice</h1>
      </div>
    `;
  }

  private static buildNotificationContent(courses: CourseModel[], archiveDateStr: string): string {
    return `
      <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 15px; line-height: 1.6;">
          The following course${courses.length > 1 ? 's are' : ' is'} assigned to a semester that has ended and will be
          <strong>automatically cleaned up and archived on ${archiveDateStr}</strong> unless the semester is updated.
        </p>
        ${courses.map((c) => this.buildCourseActionsSummary(c, '#856404', '#fff8e1', '#ffc107')).join('')}
        <p style="font-size: 15px; line-height: 1.6;">
          <strong>To prevent this</strong>, simply update the course's semester to one that has not yet ended before ${archiveDateStr}.
        </p>
        <p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
          This is an automated cleanup process. <strong>If this course has ended and is no longer in use, you can safely disregard this email</strong>.
        </p>
      </div>
    `;
  }

  private static buildFinalWarningHeader(): string {
    return `
      <div style="background: linear-gradient(135deg, #d32f2f, #b71c1c); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">FINAL NOTICE: Courses Will Be Archived in 4 Days</h1>
      </div>
    `;
  }

  private static buildFinalWarningContent(courses: CourseModel[], archiveDateStr: string): string {
    return `
      <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; line-height: 1.6; color: #d32f2f; font-weight: 600;">
          This is your last chance to update the semester for the following course${courses.length > 1 ? 's' : ''} to one that hasn't yet ended to avoid automatic cleanup and archival.
        </p>
        ${courses.map((c) => this.buildCourseActionsSummary(c, '#c62828', '#ffebee', '#d32f2f')).join('')}
        <p style="font-size: 15px; line-height: 1.6; background: #e8f5e9; padding: 12px 16px; border-radius: 4px; border-left: 4px solid #4caf50;">
          <strong style="color: #2e7d32;">To prevent this:</strong> Update the course's semester to one that has not yet ended before ${archiveDateStr}.
        </p>
      </div>
    `;
  }

  private static buildCourseActionsSummary(
    course: CourseModel,
    textColor: string,
    bgColor: string,
    borderColor: string,
  ): string {
    const hasDocuments = course.chatbot_doc_pdfs && course.chatbot_doc_pdfs.length > 0;
    const lmsIntegration = course.lmsIntegration;
    const lmsName = lmsIntegration?.orgIntegration?.apiPlatform || 'LMS';

    let bulletPoints = '';
    if (hasDocuments) {
      const lmsSuffix = lmsIntegration ? ` (including ones from ${lmsName})` : '';
      bulletPoints += `
        <li style="margin-bottom: 6px;">Chatbot documents will be permanently deleted${lmsSuffix}. This is just to save server space. Questions and everything else are still saved (including inserted Q&amp;A knowledge base chunks).</li>`;
    }
    if (lmsIntegration) {
      bulletPoints += `
        <li style="margin-bottom: 6px;">Any existing ${lmsName} connection will be severed</li>`;
    }
    bulletPoints += `
      <li style="margin-bottom: 6px;">The course will be marked as archived, hiding it from students. You will have the option to un-archive the course from the <a href="${process.env.DOMAIN}/course/${course.id}/settings" style="color: ${textColor};">course settings page</a>.</li>`;

    return `
      <div style="background: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 14px 18px; margin: 16px 0; border-radius: 4px;">
        <strong style="color: ${textColor};">As a reminder, this will do the following to
          <a href="${process.env.DOMAIN}/course/${course.id}/settings" style="color: ${textColor}; text-decoration: underline;">${course.name}</a>${course.semester ? ` <span style="color: #888; font-weight: normal;">(${course.semester.name})</span>` : ''}:</strong>
        <ul style="margin-top: 8px; padding-left: 18px; color: ${textColor};">
          ${bulletPoints}
        </ul>
      </div>
    `;
  }


  private static buildCourseList(courses: CourseModel[], linkColor: string): string {
    return `
      <ul style="padding-left: 20px; margin: 16px 0;">
        ${courses
          .map(
            (c) => `
          <li style="margin-bottom: 6px;">
            <a href="${process.env.DOMAIN}/course/${c.id}/settings" style="color: ${linkColor}; text-decoration: underline; font-weight: 600;">${c.name}</a>
            ${c.semester ? `<span style="color: #888;"> (${c.semester.name})</span>` : ''}
          </li>`,
          )
          .join('')}
      </ul>
    `;
  }
}