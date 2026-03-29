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


  static buildConfirmationEmail(
    courses: CourseModel[],
    warningDateStr: string,
  ): string {
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        ${this.buildConfirmationHeader()}
        ${this.buildConfirmationContent(courses, warningDateStr)}
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

  /**
   * Build the main content section
   */
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

  /**
   * Build the introductory text
   */
  private static buildIntroText(courses: CourseModel[], archiveDateStr: string): string {
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        The following course${courses.length > 1 ? 's are' : ' is'} assigned to a semester that has ended and will be <strong>automatically archived on ${archiveDateStr}</strong>:
      </p>
    `;
  }

  /**
   * Build the list of courses to be archived
   */
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

  /**
   * Build the warning box explaining what will happen
   */
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

  /**
   * Build the text explaining how to prevent archiving
   */
  private static buildPreventionText(archiveDateStr: string): string {
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        <strong>To prevent this</strong>, simply re-assign the course to a semester that has not yet ended before ${archiveDateStr}.
      </p>
    `;
  }

  /**
   * Build the footer with disclaimer
   */
  private static buildFooter(): string {
    return `
      <p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
        This is an automated cleanup process. If this course has ended and is not being used anymore, you can safely disregard this email.
      </p>
    `;
  }

  /**
   * Build the header section for confirmation email
   */
  private static buildConfirmationHeader(): string {
    return `
      <div style="background: linear-gradient(135deg, #388e3c, #2e7d32); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Course Archival Completed</h1>
      </div>
    `;
  }

  /**
   * Build the main content section for confirmation email
   */
  private static buildConfirmationContent(courses: CourseModel[], warningDateStr: string): string {
    return `
      <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        ${this.buildConfirmationIntroText(courses, warningDateStr)}
        ${this.buildConfirmationCourseList(courses)}
        ${this.buildUndoWarning()}
        ${this.buildConfirmationFooter()}
      </div>
    `;
  }

  /**
   * Build the introductory text for confirmation email
   */
  private static buildConfirmationIntroText(courses: CourseModel[], warningDateStr: string): string {
    const courseText = courses.length === 1 ? 'course' : 'courses';
    const hasHave = courses.length === 1 ? 'has' : 'have';
    
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        Following the warning email sent on <strong>${warningDateStr}</strong>, the ${courseText} listed below ${hasHave} been archived:
      </p>
    `;
  }

  /**
   * Build the list of archived courses
   */
  private static buildConfirmationCourseList(courses: CourseModel[]): string {
    const courseListHtml = courses
      .map(
        (c) =>
          `<li style="margin-bottom: 6px; color: #388e3c; font-weight: 600;">
            ${c.name}
            ${c.semester ? ` <span style="color: #888; font-weight: normal;">(${c.semester.name})</span>` : ''}
          </li>`,
      )
      .join('');

    return `
      <ul style="padding-left: 20px; margin: 16px 0;">
        ${courseListHtml}
      </ul>
    `;
  }

  /**
   * Build the undo warning box
   */
  private static buildUndoWarning(): string {
    return `
      <div style="background: #ffebee; border-left: 4px solid #d32f2f; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #c62828;">⚠️ This action cannot be undone.</strong>
        <p style="margin: 8px 0 0 0; color: #c62828;">
          All course data, chatbot documents, and LMS integrations have been permanently removed.
        </p>
      </div>
    `;
  }

  /**
   * Build the footer for confirmation email
   */
  private static buildConfirmationFooter(): string {
    return `
      <p style="font-size: 15px; line-height: 1.6; color: #666;">
        You can now disregard this email.
      </p>
      <p style="font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
        This is an automated message from the HelpMe Course Cleanup system.
      </p>
    `;
  }
}