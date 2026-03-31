import { CourseModel } from '../course/course.entity';
import * as cheerio from 'cheerio';

function validateHtml(html: string): void {
  const originalTags = html.match(/<(?!\/)(?!br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!\/>)/g) || [];
  const closingTags = html.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  
  const $ = cheerio.load(html, { xmlMode: false }, false);
  const serialized = $.html();
  
  const serializedOpeningTags = serialized.match(/<(?!\/)(?!br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!\/>)/g) || [];
  const serializedClosingTags = serialized.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  
  const difference = serializedClosingTags.length - closingTags.length;
  if (closingTags.length !== serializedClosingTags.length) {
    let errorMsg: string;
    if (difference > 0) {
      errorMsg = `Invalid HTML: You have ${difference} unclosed tag(s).`;
    } else {
      errorMsg = `Invalid HTML: You have ${Math.abs(difference)} orphaned closing tag(s) without opening tags.`;
    }
    throw new Error(errorMsg);
  }  
  if (Math.abs(serialized.length - html.length) > Math.max(100, html.length * 0.05)) {
    throw new Error(`Invalid HTML: Structure significantly modified after parsing.`);
  }
}

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
    
    validateHtml(emailBody);
    return emailBody;
  }

  static buildConfirmationEmail(
    courses: CourseModel[],
    archivalDateStr: string,
  ): string {
    const emailBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
        ${this.buildConfirmationHeader()}
        ${this.buildConfirmationContent(courses, archivalDateStr)}
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

  private static buildConfirmationHeader(): string {
    return `
      <div style="background: linear-gradient(135deg, #1a73e8, #174ea6); padding: 24px 32px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Course Archival Completed</h1>
      </div>
    `;
  }

  private static buildConfirmationContent(courses: CourseModel[], archivalDateStr: string): string {
    return `
      <div style="padding: 24px 32px; background: #fff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        ${this.buildConfirmationIntroText(courses, archivalDateStr)}
        ${this.buildConfirmationCourseList(courses)}
        ${this.buildUndoWarning()}
        ${this.buildConfirmationFooter()}
      </div>
    `;
  }

  private static buildConfirmationIntroText(courses: CourseModel[], archivalDateStr: string): string {
    const courseText = courses.length === 1 ? 'course' : 'courses';
    const hasHave = courses.length === 1 ? 'has' : 'have';
    
    return `
      <p style="font-size: 15px; line-height: 1.6;">
        The following ${courseText} ${hasHave} been successfully archived on <strong>${archivalDateStr}</strong>:
      </p>
    `;
  }

  private static buildConfirmationCourseList(courses: CourseModel[]): string {
    const courseListHtml = courses
      .map(
        (c) =>
          `<li style="margin-bottom: 6px; color: #1a73e8; font-weight: 600;">
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


  private static buildUndoWarning(): string {
    return `
      <div style="background: #ffebee; border-left: 4px solid #d32f2f; padding: 14px 18px; margin: 20px 0; border-radius: 4px;">
        <strong style="color: #c62828;">This action cannot be undone.</strong>
        <p style="margin: 8px 0 0 0; color: #c62828;">
          All course data, chatbot documents, and LMS integrations have been permanently removed.
        </p>
      </div>
    `;
  }
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