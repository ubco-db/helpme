import { CourseModel } from '../course/course.entity';

export class CourseCleanupEmailBuilder {
  static buildNotificationEmail(
    courses: CourseModel[],
    archiveDateStr: string,
  ): string {
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        ${this.buildHeader()}
        ${this.buildContent(courses, archiveDateStr)}
      </div>
    `;
    
    return emailBody;
  }
   */
  private static buildHeader(): string {
    return `
      <div style="background: linear-gradient(135deg, #1a73e8, #174ea6); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Course Cleanup Notice</h1>
      </div>
    `;
  }
  private static buildContent(courses: CourseModel[], archiveDateStr: string): string {
    return `
      <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        ${this.buildIntroText(courses, archiveDateStr)}
        ${this.buildCourseList(courses)}
        ${this.buildWarningBox()}
        ${this.buildPreventionText(archiveDateStr)}
        ${this.buildFooter()}
      </div>
    `;
  }

  private static buildIntroText(courses: CourseModel[], archiveDateStr: string): string {
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        The following course${courses.length > 1 ? 's are' : ' is'} assigned to a semester that has ended and will be <strong>automatically archived on ${archiveDateStr}</strong>:
      </p>
    `;
  }

  private static buildCourseList(courses: CourseModel[]): string {
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
      <ul style="padding-left: 20px; margin: 16px 0;">
        ${courseListHtml}
      </ul>
    `;
  }

  private static buildWarningBox(): string {
    return `
      <div style="background: #fff8e1; border-left: 4px solid #ffc107; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #856404;">On the archive date, the following will happen automatically:</strong>
        <ul style="margin-top: 8px; padding-left: 18px; color: #856404;">
          <li>All uploaded chatbot documents will be deleted (to save server space — chatbot questions are still saved)</li>
          <li>Any data downloaded from Canvas will be removed</li>
          <li>The Canvas/LMS integration will be severed</li>
          <li>The course will be marked as archived</li>
        </ul>
      </div>
    `;
  }

  private static buildPreventionText(archiveDateStr: string): string {
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        <strong>To prevent this</strong>, simply re-assign the course to a semester that has not yet ended before ${archiveDateStr}.
      </p>
    `;
  }

  private static buildFooter(): string {
    return `
      <p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
        This is an automated cleanup process. If this course has ended and is not being used anymore, you can safely disregard this email.
      </p>
    `;
  }
}