// HTML Template for the weekly summary email

import { CourseModel } from '../course/course.entity';
import * as cheerio from 'cheerio';

export interface ChatbotStats {
  totalQuestions: number;
  uniqueStudents: number;
  avgQuestionsPerStudent: number;
  byDayOfWeek: { day: string; count: number }[];
  mostActiveDay: string;
}

export interface AsyncQuestionStats {
  total: number;
  aiResolved: number;
  humanAnswered: number;
  stillNeedHelp: number;
  withNewComments: number;
  avgResponseTime: number | null;
}

export interface QueueStats {
  totalQuestions: number;
  uniqueStudents: number;
  avgWaitTime: number | null;
  avgHelpTime: number | null;
  queueNames: string[];
}

export interface NewStudentData {
  id: number;
  name: string;
  email: string;
  joinedAt: Date;
}

export interface TopStudentData {
  id: number;
  name: string;
  email: string;
  questionsAsked: number;
}

export interface StaffPerformanceData {
  id: number;
  name: string;
  questionsHelped: number;
  asyncQuestionsHelped: number;
  avgHelpTime: number | null;
}

export interface MostActiveDaysData {
  byDayOfWeek: { day: string; count: number }[];
  mostActiveDay: string;
}

export interface PeakHoursData {
  peakHours: string[];
  quietHours: string[];
}

export interface AsyncQuestionDetailData {
  id: number;
  abstract: string;
  status: string;
  createdAt: Date;
  daysAgo: number;
}

export interface RecommendationData {
  type: 'warning' | 'info' | 'success';
  message: string;
}

export interface CourseStatsData {
  course: CourseModel;
  chatbotStats: ChatbotStats;
  asyncStats: AsyncQuestionStats;
  asyncQuestionsNeedingHelp: AsyncQuestionDetailData[];
  queueStats: QueueStats;
  newStudents: NewStudentData[];
  topStudents: TopStudentData[];
  staffPerformance: StaffPerformanceData[];
  mostActiveDays: MostActiveDaysData;
  peakHours: PeakHoursData;
  recommendations: RecommendationData[];
  suggestArchive: boolean;
}
function validateHtml(html: string): void {
  const originalTags = html.match(/<(?!\/)(?!br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!\/)>/g) || [];
  const closingTags = html.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  
  const $ = cheerio.load(html, { xmlMode: false }, false);
  const serialized = $.html();
  
  const serializedOpeningTags = serialized.match(/<(?!\/)(?!br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)([a-zA-Z][a-zA-Z0-9]*)[^>]*(?<!\/)>/g) || [];
  const serializedClosingTags = serialized.match(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g) || [];
  
  const difference = serializedClosingTags.length - closingTags.length;
  if (closingTags.length !== serializedClosingTags.length) {
    let errorMsg: string;
    if (difference > 0) {
      errorMsg = `Invalid HTML: You have ${difference} unclosed tag(s).`;
    } else {
      errorMsg = `Invalid HTML:You have ${Math.abs(difference)} orphaned closing tag(s) without opening tags.`;
    }
    throw new Error(errorMsg);
  }  
  if (Math.abs(serialized.length - html.length) > Math.max(100, html.length * 0.05)) {
    throw new Error(`Invalid HTML: Structure significantly modified after parsing.`);
  }
}

export class WeeklySummaryBuilder {
  static formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  static buildHeader(courseStatsArray: CourseStatsData[], weekStartDate: Date): string {
    const weekEndDate = new Date();
    return `
      <h1 style="color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px;">
        HelpMe Weekly Summary
      </h1>
      <p style="color: #7f8c8d; font-size: 16px;">
        Week of ${this.formatDate(weekStartDate)} - ${this.formatDate(weekEndDate)}
      </p>
      <p style="color: #34495e; margin-bottom: 30px;">
        Summary for ${courseStatsArray.length} course${courseStatsArray.length !== 1 ? 's' : ''}
      </p>
    `;
  }

  static wrapCourseContent(course: CourseModel, content: string): string {
    return `
      <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-top: 0;">${course.name}</h2>
        ${content}
      </div>
    `;
  }

  static buildNewStudentsSection(newStudents: NewStudentData[], course: CourseModel): string {
    if (newStudents.length === 0) return '';

    let html = `
      <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #2e7d32; margin-top: 0;">New Students This Week</h3>
        <p style="color: #2e7d32; margin-bottom: 10px;">
          <strong>${newStudents.length}</strong> new student${newStudents.length !== 1 ? 's' : ''} joined this course:
        </p>
        <ul style="line-height: 1.6; color: #1b5e20; margin-bottom: 10px;">
    `;

    newStudents.forEach((student) => {
      html += `<li><strong>${student.name}</strong> (${student.email})</li>`;
    });

    html += `
        </ul>
        <p style="color: #2e7d32; font-size: 14px; margin: 10px 0 0 0;">
          <em>If any of these students should not be in the course, please remove them from the course under <a href="${process.env.DOMAIN}/course/${course.id}/settings/roster" style="color: #1b5e20; text-decoration: underline;">Course Roster</a> 
          and either disable or change the course invite link under <a href="${process.env.DOMAIN}/course/${course.id}/settings" style="color: #1b5e20; text-decoration: underline;">Course Settings</a>.</em>
        </p>
      </div>
    `;

    return html;
  }

  static buildArchiveSuggestionSection(course: CourseModel): string {
    return `
      <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #856404; margin-top: 0;">Consider Archiving This Course</h3>
        <p style="color: #856404; margin-bottom: 0;">
          No activity in the past 4 weeks. You may want to <a href="${process.env.DOMAIN}/course/${course.id}/settings" style="color: #856404; text-decoration: underline; font-weight: bold;">archive this course</a> if the semester has ended.
        </p>
      </div>
    `;
  }

  static buildAsyncQuestionsSection(asyncStats: AsyncQuestionStats, asyncQuestionsNeedingHelp: AsyncQuestionDetailData[], course: CourseModel): string {
    if (course.courseSettings?.asyncQueueEnabled === false) return '';

    let html = `
      <h3 style="color: #e74c3c; margin-top: 20px;">Anytime Questions</h3>
      <ul style="line-height: 1.8; color: #34495e;">
        <li>📊 <strong>${asyncStats.total || 0}</strong> total questions</li>
        <li>✅ <strong style="color: #27ae60;">${asyncStats.aiResolved || 0}</strong> resolved by AI</li>
        <li>👤 <strong style="color: #3498db;">${asyncStats.humanAnswered || 0}</strong> answered by staff</li>
        <li>⚠️  <strong style="color: #e74c3c;">${asyncStats.stillNeedHelp || 0}</strong> still need help</li>
        <li>💬 <strong>${asyncStats.withNewComments || 0}</strong> with new comments this week</li>
    `;

    if (asyncStats.avgResponseTime !== null) {
      html += `<li>Average response time: <strong>${asyncStats.avgResponseTime.toFixed(1)}</strong> hours</li>`;
    }

    html += `</ul>`;

    if (asyncQuestionsNeedingHelp.length > 0) {
      html += `
        <div style="background-color: #fef5f5; border-left: 4px solid #e74c3c; padding: 15px; margin-top: 15px; border-radius: 3px;">
          <p style="margin-top: 0; margin-bottom: 10px; color: #c0392b;">
            <strong><a href="${process.env.DOMAIN}/course/${course.id}/async_centre" style="color: #c0392b; text-decoration: underline;">Anytime Questions</a> that still need help:</strong>
          </p>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: #34495e;">
      `;

      asyncQuestionsNeedingHelp.forEach((q) => {
        const isOld = q.daysAgo >= 7;
        const style = isOld ? 'style="color: #c0392b; font-weight: bold;"' : 'style="color: #34495e;"';
        html += `
          <li ${style}>
            "${q.abstract}${q.abstract.length === 100 ? '...' : ''}"
            <span style="color: #7f8c8d; font-size: 0.9em;">— ${q.daysAgo} day${q.daysAgo !== 1 ? 's' : ''} ago${isOld ? ' ⚠️' : ''}</span>
          </li>
        `;
      });

      html += `
          </ul>
        </div>
      `;
    } else if (asyncStats.total === 0) {
      html += `<p style="color: #7f8c8d;">No anytime questions this week.</p>`;
    }

    return html;
  }

  static buildChatbotActivitySection(chatbotStats: ChatbotStats): string {
    if (chatbotStats.totalQuestions === 0) return '';

    let html = `
      <h3 style="color: #3498db; margin-top: 0;">Chatbot Activity</h3>
      <ul style="line-height: 1.8; color: #34495e;">
        <li><strong>${chatbotStats.totalQuestions}</strong> questions asked by <strong>${chatbotStats.uniqueStudents}</strong> unique student${chatbotStats.uniqueStudents !== 1 ? 's' : ''}</li>
      </ul>
      
      <h4 style="color: #34495e;">Daily Breakdown:</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    `;

    chatbotStats.byDayOfWeek.forEach((dayData) => {
      if (dayData.count > 0) {
        const barWidth = Math.max((dayData.count / chatbotStats.totalQuestions) * 100, 5);
        html += `
          <tr>
            <td style="padding: 5px; width: 100px; color: #34495e;">${dayData.day}:</td>
            <td style="padding: 5px;">
              <div style="background-color: #3498db; height: 20px; width: ${barWidth}%; display: inline-block; border-radius: 3px;"></div>
              <span style="margin-left: 10px; color: #34495e;">${dayData.count}</span>
            </td>
          </tr>
        `;
      }
    });

    html += `</table>`;

    return html;
  }

  static buildQueueSection(queueStats: QueueStats): string {
    if (queueStats.totalQuestions === 0) return '';

    const queueTitle = queueStats.queueNames.length > 0 ? queueStats.queueNames.join(', ') : 'Office Hours Queue';

    let html = `
      <h3 style="color: #9b59b6; margin-top: 20px;">${queueTitle}</h3>
      <ul style="line-height: 1.8; color: #34495e;">
        <li><strong>${queueStats.totalQuestions}</strong> questions from <strong>${queueStats.uniqueStudents}</strong> unique student${queueStats.uniqueStudents !== 1 ? 's' : ''}</li>
    `;

    if (queueStats.avgWaitTime !== null) {
      html += `<li>Average wait time: <strong>${queueStats.avgWaitTime.toFixed(1)}</strong> minutes</li>`;
    }

    if (queueStats.avgHelpTime !== null) {
      html += `<li>Average help time: <strong>${queueStats.avgHelpTime.toFixed(1)}</strong> minutes</li>`;
    }

    html += `</ul>`;

    return html;
  }

  static buildMostActiveDaysSection(mostActiveDays: MostActiveDaysData, queueStats: QueueStats): string {
    if (queueStats.totalQuestions === 0 || !mostActiveDays.byDayOfWeek.some((d) => d.count > 0)) return '';

    const totalQuestions = mostActiveDays.byDayOfWeek.reduce((sum, d) => sum + d.count, 0);

    let html = `
      <h3 style="color: #16a085; margin-top: 20px;">Most Active Days</h3>
      <p style="color: #7f8c8d; margin-bottom: 10px;">Queue activity by day of the week:</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    `;

    mostActiveDays.byDayOfWeek.forEach((dayData) => {
      if (dayData.count > 0) {
        const barWidth = Math.max((dayData.count / totalQuestions) * 100, 5);
        const isMostActive = dayData.day === mostActiveDays.mostActiveDay;
        html += `
          <tr>
            <td style="padding: 5px; width: 100px; color: #34495e; font-weight: ${isMostActive ? 'bold' : 'normal'};">${dayData.day}:</td>
            <td style="padding: 5px;">
              <div style="background-color: ${isMostActive ? '#16a085' : '#95a5a6'}; height: 20px; width: ${barWidth}%; display: inline-block; border-radius: 3px;"></div>
              <span style="margin-left: 10px; color: #34495e; font-weight: ${isMostActive ? 'bold' : 'normal'};">${dayData.count}</span>
            </td>
          </tr>
        `;
      }
    });

    html += `
      </table>
      <p style="color: #16a085; font-size: 14px; margin: 0;"><strong>Busiest day:</strong> ${mostActiveDays.mostActiveDay}</p>
    `;

    return html;
  }

  static buildPeakHoursSection(peakHours: PeakHoursData, queueStats: QueueStats): string {
    if (queueStats.totalQuestions === 0 || (peakHours.peakHours.length === 0 && peakHours.quietHours.length === 0)) return '';

    let html = `<h3 style="color: #e67e22; margin-top: 20px;">Peak Hours</h3>`;

    if (peakHours.peakHours.length > 0) {
      html += `
        <p style="color: #34495e; margin-bottom: 10px;">
          <strong>Busiest times:</strong> <span style="color: #e67e22;">${peakHours.peakHours.join(', ')}</span>
        </p>
      `;
    }

    if (peakHours.quietHours.length > 0) {
      html += `
        <p style="color: #34495e; margin-top: 5px;">
          <strong>Quieter times:</strong> <span style="color: #7f8c8d;">${peakHours.quietHours.join(', ')}</span>
        </p>
      `;
    }

    return html;
  }

  static buildTopStudentsSection(topStudents: TopStudentData[]): string {
    if (topStudents.length === 0) return '';

    let html = `
      <h3 style="color: #f39c12; margin-top: 20px;">Most Active Students</h3>
      <p style="color: #7f8c8d; margin-bottom: 10px;">Top students by queue questions asked this week:</p>
      <ol style="line-height: 1.8; color: #34495e;">
    `;

    topStudents.forEach((student) => {
      html += `
        <li><strong>${student.name}</strong> - ${student.questionsAsked} question${student.questionsAsked !== 1 ? 's' : ''}</li>
      `;
    });

    html += `</ol>`;

    return html;
  }

  static buildStaffPerformanceSection(staffPerformance: StaffPerformanceData[], course: CourseModel): string {
    if (staffPerformance.length === 0) return '';

    const queueEnabled = course.courseSettings?.queueEnabled !== false;
    const asyncEnabled = course.courseSettings?.asyncQueueEnabled !== false;

    let headerRow = `<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Staff Member</th>`;
    if (queueEnabled) headerRow += `<th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Queue Questions</th>`;
    if (asyncEnabled) headerRow += `<th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Anytime Questions</th>`;
    if (queueEnabled) headerRow += `<th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Avg Queue Help Time</th>`;

    let html = `
      <h3 style="color: #8e44ad; margin-top: 20px;">Staff Performance</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background-color: #ecf0f1;">
            ${headerRow}
          </tr>
        </thead>
        <tbody>
    `;

    staffPerformance.forEach((staff) => {
      let dataRow = `<td style="padding: 8px; border: 1px solid #ddd;">${staff.name}</td>`;
      if (queueEnabled) dataRow += `<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.questionsHelped}</td>`;
      if (asyncEnabled) dataRow += `<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.asyncQuestionsHelped}</td>`;
      if (queueEnabled) dataRow += `<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.avgHelpTime !== null ? staff.avgHelpTime.toFixed(1) + ' min' : 'N/A'}</td>`;
      html += `<tr>${dataRow}</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  static buildRecommendationsSection(recommendations: RecommendationData[]): string {
    if (recommendations.length === 0) return '';

    let html = `<h3 style="color: #2980b9; margin-top: 20px;">Recommendations</h3>`;

    recommendations.forEach((rec) => {
      let bgColor, borderColor;

      if (rec.type === 'warning') {
        bgColor = '#fff3cd';
        borderColor = '#ffc107';
      } else if (rec.type === 'success') {
        bgColor = '#d4edda';
        borderColor = '#28a745';
      } else {
        bgColor = '#d1ecf1';
        borderColor = '#17a2b8';
      }

      html += `
        <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 12px; margin-bottom: 10px; border-radius: 3px;">
          <p style="margin: 0; color: #34495e;">${rec.message}</p>
        </div>
      `;
    });

    return html;
  }

  static buildFooter(): string {
    return `
      <hr style="border: 1px solid #ecf0f1; margin: 30px 0;">
      <p style="color: #95a5a6; font-size: 12px; text-align: center;">
        Weekly summary from HelpMe.<br>
        Manage your email preferences in <a href="${process.env.DOMAIN}/profile" style="color: #7f8c8d; text-decoration: underline;">settings</a>.
      </p>
    `;
  }

  static buildConsolidatedEmail(courseStatsArray: CourseStatsData[], weekStartDate: Date): string {
    let emailBody = '';
    emailBody += this.buildHeader(courseStatsArray, weekStartDate);

    for (const courseData of courseStatsArray) {
      const {
        course,
        chatbotStats,
        asyncStats,
        asyncQuestionsNeedingHelp,
        queueStats,
        newStudents,
        topStudents,
        staffPerformance,
        mostActiveDays,
        peakHours,
        recommendations,
        suggestArchive,
      } = courseData;

      let courseBody = '';
      courseBody += this.buildNewStudentsSection(newStudents, course);

      if (suggestArchive) {
        courseBody += this.buildArchiveSuggestionSection(course);
      } else {
        const queueEnabled = course.courseSettings?.queueEnabled !== false;
        const asyncEnabled = course.courseSettings?.asyncQueueEnabled !== false;
        const chatbotEnabled = course.courseSettings?.chatBotEnabled !== false;

        const hasActivity =
          (chatbotEnabled && chatbotStats.totalQuestions > 0) ||
          (asyncEnabled && asyncStats.total > 0) ||
          (queueEnabled && queueStats.totalQuestions > 0);

        if (!hasActivity) {
          courseBody += `<p style="color: #7f8c8d; font-style: italic;">No activity this week.</p>`;
        } else {
          if (asyncEnabled) courseBody += this.buildAsyncQuestionsSection(asyncStats, asyncQuestionsNeedingHelp, course);
          if (chatbotEnabled) courseBody += this.buildChatbotActivitySection(chatbotStats);
          if (queueEnabled) courseBody += this.buildQueueSection(queueStats);
          if (queueEnabled) courseBody += this.buildMostActiveDaysSection(mostActiveDays, queueStats);
          if (queueEnabled) courseBody += this.buildPeakHoursSection(peakHours, queueStats);
          if (queueEnabled) courseBody += this.buildTopStudentsSection(topStudents);
          courseBody += this.buildStaffPerformanceSection(staffPerformance, course);
          courseBody += this.buildRecommendationsSection(recommendations);
        }
      }

      emailBody += this.wrapCourseContent(course, courseBody);
    }

    emailBody += this.buildFooter();

    const finalHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        ${emailBody}
      </div>
    `;

    validateHtml(finalHtml);

    return finalHtml;
  }
}
