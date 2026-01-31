import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from './mail.service';
import { UserCourseModel } from '../profile/user-course.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { CourseModel } from '../course/course.entity';
import { MailServiceType, Role } from '@koh/common';
import { MoreThanOrEqual } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { UserSubscriptionModel } from './user-subscriptions.entity';

interface ChatbotStats {
  totalQuestions: number;
  uniqueStudents: number;
  avgQuestionsPerStudent: number;
  byDayOfWeek: { day: string; count: number }[];
  mostActiveDay: string;
}

interface AsyncQuestionStats {
  total: number;
  aiResolved: number;
  humanAnswered: number;
  stillNeedHelp: number;
  withNewComments: number;
  avgResponseTime: number | null;
}

@Injectable()
export class WeeklySummaryService {
  constructor(private mailService: MailService) {}

  // Run every week
  @Cron(CronExpression.EVERY_WEEK)
  async sendWeeklySummaries() {
    console.log('Starting weekly summary email job...');
    const startTime = Date.now();

    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Get all professors with their courses
      const professorCourses = await UserCourseModel.createQueryBuilder('uc')
        .innerJoinAndSelect('uc.user', 'user')
        .innerJoinAndSelect('uc.course', 'course')
        .leftJoinAndSelect('course.semester', 'semester')
        .where('uc.role = :role', { role: Role.PROFESSOR })
        .andWhere('course.deletedAt IS NULL')
        .andWhere('course.enabled = :enabled', { enabled: true })
        .getMany();

      console.log(
        `Found ${professorCourses.length} professor-course relationships`,
      );

      const professorMap = new Map<number, typeof professorCourses>();
      for (const pc of professorCourses) {
        if (!professorMap.has(pc.user.id)) {
          professorMap.set(pc.user.id, []);
        }
        professorMap.get(pc.user.id).push(pc);
      }

      console.log(`Grouped into ${professorMap.size} unique professors`);

      let emailsSent = 0;
      let emailsFailed = 0;

      // Process each professor with all their courses
      for (const [professorId, courses] of professorMap.entries()) {
        const professor = courses[0].user;

        try {
          // const subscription = await UserSubscriptionModel.findOne({
          //   where: {
          //     userId: professorId,
          //     isSubscribed: true,
          //     service: {
          //       serviceType: MailServiceType.WEEKLY_COURSE_SUMMARY,
          //     },
          //   },
          //   relations: ['service'],
          // });

          // if (!subscription) {
          //   console.log(
          //     `Professor ${professor.email} unsubscribed from weekly summaries`,
          //   );
          //   continue;
          // }

          // Gather statistics for all courses
          const courseStatsArray = [];
          for (const professorCourse of courses) {
            const chatbotStats = await this.getChatbotStats(
              professorCourse.courseId,
              lastWeek,
            );
            const asyncStats = await this.getAsyncQuestionStats(
              professorCourse.courseId,
              lastWeek,
            );

            const hasActivity =
              chatbotStats.totalQuestions > 0 || asyncStats.total > 0;

            // If no activity, check if should suggest archiving
            if (!hasActivity) {
              const shouldSuggestArchive = await this.shouldSuggestArchiving(
                professorCourse.course,
              );
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
                suggestArchive: shouldSuggestArchive,
              });
            } else {
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
                suggestArchive: false,
              });
            }
          }

          // Build consolidated email with all courses
          const emailHtml = this.buildConsolidatedWeeklySummaryEmail(
            courseStatsArray,
            lastWeek,
          );

          const courseNames = courses.map((c) => c.course.name).join(', ');
          const subject =
            courses.length === 1
              ? `HelpMe Weekly Summary: ${courses[0].course.name} - Week of ${this.formatDate(lastWeek)}`
              : `HelpMe Weekly Summary: ${courses.length} Courses - Week of ${this.formatDate(lastWeek)}`;

          await this.mailService.sendEmail({
            receiverOrReceivers: professor.email,
            type: MailServiceType.WEEKLY_COURSE_SUMMARY,
            subject,
            content: emailHtml,
          });

          emailsSent++;
          console.log(
            `Sent consolidated weekly summary to ${professor.email} for ${courses.length} course(s): ${courseNames}`,
          );
        } catch (error) {
          emailsFailed++;
          console.error(
            `Failed to send weekly summary to ${professor.email}:`,
            error,
          );
          Sentry.captureException(error, {
            extra: {
              professorId,
              courseCount: courses.length,
            },
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `Weekly summary job completed in ${duration}ms. Sent: ${emailsSent}, Failed: ${emailsFailed}`,
      );

    } catch (error) {
      console.error('Fatal error in weekly summary job:', error);
      Sentry.captureException(error);
    }
  }

  private async getChatbotStats(
    courseId: number,
    since: Date,
  ): Promise<ChatbotStats> {
    const interactions = await InteractionModel.createQueryBuilder('interaction')
      .leftJoinAndSelect('interaction.questions', 'questions')
      .leftJoinAndSelect('interaction.user', 'user')
      .where('interaction.course = :courseId', { courseId })
      .andWhere('interaction.timestamp >= :since', { since })
      .getMany();

    const totalQuestions = interactions.reduce(
      (sum, i) => sum + (i.questions?.length || 0),
      0,
    );

    const uniqueStudents = new Set(interactions.map((i) => i.user.id)).size;

    const avgQuestionsPerStudent =
      uniqueStudents > 0 ? totalQuestions / uniqueStudents : 0;

    const byDayOfWeek = this.groupByDayOfWeek(interactions);

    const mostActiveDay =
      byDayOfWeek.length > 0
        ? byDayOfWeek.reduce((max, day) =>
            day.count > max.count ? day : max,
          ).day
        : 'N/A';

    return {
      totalQuestions,
      uniqueStudents,
      avgQuestionsPerStudent,
      byDayOfWeek,
      mostActiveDay,
    };
  }

  private async getAsyncQuestionStats(
    courseId: number,
    since: Date,
  ): Promise<AsyncQuestionStats> {
    const questions = await AsyncQuestionModel.createQueryBuilder('aq')
      .leftJoinAndSelect('aq.comments', 'comments')
      .where('aq.courseId = :courseId', { courseId })
      .andWhere('aq.createdAt >= :since', { since })
      .getMany();

    const total = questions.length;
    const aiResolved = questions.filter(
      (q) => q.aiAnswerText && q.status === 'AIAnswered',
    ).length;
    const humanAnswered = questions.filter(
      (q) => q.answerText && q.status === 'HumanAnswered',
    ).length;
    const stillNeedHelp = questions.filter((q) => !q.closedAt).length;
    const withNewComments = questions.filter((q) =>
      q.comments?.some((c) => c.createdAt >= since),
    ).length;

    // Calculate average response time for answered questions
    const answeredQuestions = questions.filter((q) => q.closedAt);
    const avgResponseTime =
      answeredQuestions.length > 0
        ? answeredQuestions.reduce(
            (sum, q) =>
              sum +
              (q.closedAt.getTime() - new Date(q.createdAt).getTime()) /
                (1000 * 60 * 60),
            0,
          ) / answeredQuestions.length
        : null;

    return {
      total,
      aiResolved,
      humanAnswered,
      stillNeedHelp,
      withNewComments,
      avgResponseTime,
    };
  }

  private groupByDayOfWeek(
    interactions: InteractionModel[],
  ): { day: string; count: number }[] {
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const dayCounts = new Array(7).fill(0);

    interactions.forEach((interaction) => {
      const dayOfWeek = new Date(interaction.timestamp).getDay();
      dayCounts[dayOfWeek]++;
    });

    return dayNames.map((day, index) => ({
      day,
      count: dayCounts[index],
    }));
  }

  private async shouldSuggestArchiving(course: CourseModel): Promise<boolean> {
    // Check if semester has ended
    if (course.semester?.endDate) {
      const semesterEndDate = new Date(course.semester.endDate);
      if (semesterEndDate < new Date()) {
        return true;
      }
    }

    // Check for recent activity (4 weeks)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const recentInteractions = await InteractionModel.count({
      where: {
        course: { id: course.id },
        timestamp: MoreThanOrEqual(fourWeeksAgo),
      },
    });

    const recentAsyncQuestions = await AsyncQuestionModel.count({
      where: {
        courseId: course.id,
        createdAt: MoreThanOrEqual(fourWeeksAgo),
      },
    });

    return recentInteractions === 0 && recentAsyncQuestions === 0;
  }

  private buildConsolidatedWeeklySummaryEmail(
    courseStatsArray: Array<{
      course: CourseModel;
      chatbotStats: ChatbotStats;
      asyncStats: AsyncQuestionStats;
      suggestArchive: boolean;
    }>,
    weekStartDate: Date,
  ): string {
    const weekEndDate = new Date();
    
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
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

    // Process each course
    for (const courseData of courseStatsArray) {
      const { course, chatbotStats, asyncStats, suggestArchive } = courseData;

      html += `
        <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
          <h2 style="color: #2c3e50; margin-top: 0;">${course.name}</h2>
      `;

      if (suggestArchive) {
        html += `
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="color: #856404; margin-top: 0;">Consider Archiving This Course</h3>
            <p style="color: #856404; margin-bottom: 0;">
              No activity in the past 4 weeks. You may want to archive this course if the semester has ended.
            </p>
          </div>
        `;
        continue; // Skip stats for archived courses
      }

      const hasActivity = chatbotStats.totalQuestions > 0 || asyncStats.total > 0;

      if (!hasActivity) {
        html += `
          <p style="color: #7f8c8d; font-style: italic;">No activity this week.</p>
        `;
      } else {
        // Chatbot Activity Section
        if (chatbotStats.totalQuestions > 0) {
          html += `
            <h3 style="color: #3498db; margin-top: 0;">Chatbot Activity</h3>
            <ul style="line-height: 1.8; color: #34495e;">
              <li><strong>${chatbotStats.totalQuestions}</strong> questions asked by <strong>${chatbotStats.uniqueStudents}</strong> unique student${chatbotStats.uniqueStudents !== 1 ? 's' : ''}</li>
              <li>Average: <strong>${chatbotStats.avgQuestionsPerStudent.toFixed(1)}</strong> questions per student</li>
              <li>Most active day: <strong>${chatbotStats.mostActiveDay}</strong></li>
            </ul>
            
            <h4 style="color: #34495e;">Daily Breakdown:</h4>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          `;

          chatbotStats.byDayOfWeek.forEach((dayData) => {
            if (dayData.count > 0) {
              const barWidth = Math.max(
                (dayData.count / chatbotStats.totalQuestions) * 100,
                5,
              );
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

          html += `
            </table>
          `;
        }

        // Async Questions Section
        if (asyncStats.total > 0) {
          html += `
            <h3 style="color: #e74c3c; margin-top: 20px;">Async Questions</h3>
            <ul style="line-height: 1.8; color: #34495e;">
              <li><strong>${asyncStats.total}</strong> total questions</li>
              <li><strong style="color: #27ae60;">${asyncStats.aiResolved}</strong> resolved by AI</li>
              <li><strong style="color: #3498db;">${asyncStats.humanAnswered}</strong> answered by staff</li>
              <li><strong style="color: #e74c3c;">${asyncStats.stillNeedHelp}</strong> still need help</li>
              <li><strong>${asyncStats.withNewComments}</strong> with new comments this week</li>
          `;

          if (asyncStats.avgResponseTime !== null) {
            html += `
              <li>Average response time: <strong>${asyncStats.avgResponseTime.toFixed(1)}</strong> hours</li>
            `;
          }

          html += `
            </ul>
          `;

          if (asyncStats.stillNeedHelp > 0) {
            html += `
              <div style="background-color: #fee; border-left: 4px solid #e74c3c; padding: 10px; margin-top: 15px; border-radius: 3px;">
                <p style="margin: 0; color: #c0392b;">
                  <strong>${asyncStats.stillNeedHelp}</strong> question${asyncStats.stillNeedHelp !== 1 ? 's' : ''} still need${asyncStats.stillNeedHelp === 1 ? 's' : ''} attention
                </p>
              </div>
            `;
          }
        } else if (chatbotStats.totalQuestions > 0) {
          html += `
            <h3 style="color: #e74c3c; margin-top: 20px;">Async Questions</h3>
            <p style="color: #7f8c8d;">No async questions this week.</p>
          `;
        }
      }

      html += `
        </div>
      `;
    }

    // Footer
    html += `
        <hr style="border: 1px solid #ecf0f1; margin: 30px 0;">
        <p style="color: #95a5a6; font-size: 12px; text-align: center;">
          Weekly summary from HelpMe.<br>
          Manage your email preferences in settings.
        </p>
      </div>
    `;

    return html;
  }

  private buildWeeklySummaryEmail(
    course: CourseModel,
    chatbotStats: ChatbotStats,
    asyncStats: AsyncQuestionStats,
  ): string {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Weekly Summary: ${course.name}</h2>
        <p style="color: #7f8c8d;">Week of ${this.formatDate(lastWeek)} - ${this.formatDate(new Date())}</p>
        <hr style="border: 1px solid #ecf0f1;">
    `;

    // Chatbot Activity Section
    if (chatbotStats.totalQuestions > 0) {
      html += `
        <h3 style="color: #3498db;">Chatbot Activity</h3>
        <ul style="line-height: 1.8;">
          <li><strong>${chatbotStats.totalQuestions}</strong> questions asked by <strong>${chatbotStats.uniqueStudents}</strong> unique student${chatbotStats.uniqueStudents !== 1 ? 's' : ''}</li>
          <li>Average: <strong>${chatbotStats.avgQuestionsPerStudent.toFixed(1)}</strong> questions per student</li>
          <li>Most active day: <strong>${chatbotStats.mostActiveDay}</strong></li>
        </ul>
        
        <h4 style="color: #34495e;">Daily Breakdown:</h4>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      `;

      chatbotStats.byDayOfWeek.forEach((dayData) => {
        if (dayData.count > 0) {
          const barWidth = Math.max(
            (dayData.count / chatbotStats.totalQuestions) * 100,
            5,
          );
          html += `
            <tr>
              <td style="padding: 5px; width: 100px;">${dayData.day}:</td>
              <td style="padding: 5px;">
                <div style="background-color: #3498db; height: 20px; width: ${barWidth}%; display: inline-block;"></div>
                <span style="margin-left: 10px;">${dayData.count}</span>
              </td>
            </tr>
          `;
        }
      });

      html += `
        </table>
      `;
    } else {
      html += `
        <h3 style="color: #3498db;">Chatbot Activity</h3>
        <p style="color: #7f8c8d;">No chatbot questions this week.</p>
      `;
    }

    // Async Questions Section
    if (asyncStats.total > 0) {
      html += `
        <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
        <h3 style="color: #9b59b6;">Anytime Questions</h3>
        <ul style="line-height: 1.8;">
          <li><strong>${asyncStats.total}</strong> new question${asyncStats.total !== 1 ? 's' : ''} posted</li>
          <li><strong>${asyncStats.aiResolved}</strong> resolved via AI</li>
          <li><strong>${asyncStats.humanAnswered}</strong> answered by staff</li>
          <li><strong>${asyncStats.stillNeedHelp}</strong> still need help</li>
      `;

      if (asyncStats.withNewComments > 0) {
        html += `<li> <strong>${asyncStats.withNewComments}</strong> question${asyncStats.withNewComments !== 1 ? 's' : ''} received new comments</li>`;
      }

      if (asyncStats.avgResponseTime !== null) {
        html += `<li>Average response time: <strong>${asyncStats.avgResponseTime.toFixed(1)}</strong> hours</li>`;
      }

      html += `
        </ul>
      `;

      if (asyncStats.stillNeedHelp > 0) {
        html += `
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0;">
            <strong>Action Needed:</strong> ${asyncStats.stillNeedHelp} question${asyncStats.stillNeedHelp !== 1 ? 's' : ''} still need${asyncStats.stillNeedHelp === 1 ? 's' : ''} your attention.
          </div>
        `;
      }
    } else {
      html += `
        <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
        <h3 style="color: #9b59b6;"> Anytime Questions</h3>
        <p style="color: #7f8c8d;">No async questions this week.</p>
      `;
    }

    html += `
        <hr style="border: 1px solid #ecf0f1; margin: 20px 0;">
        <p style="text-align: center;">
          <a href="${process.env.DOMAIN}/course/${course.id}" 
             style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Course Dashboard
          </a>
        </p>
      </div>
    `;

    return html;
  }

  private async sendArchiveSuggestionEmail(professorCourse: any): Promise<void> {
    const course = professorCourse.course;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Course Activity Update: ${course.name}</h2>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0;">
          <p><strong>${course.name}</strong> has had no activity in the last 4 weeks.</p>
        </div>
        
        <p>Possible reasons:</p>
        <ul>
          ${course.semester?.endDate && new Date(course.semester.endDate) < new Date() ? '<li>The semester has ended</li>' : ''}
          ${!course.enabled ? '<li>The course is currently disabled</li>' : ''}
          <li>The course may no longer be active</li>
        </ul>
        
        <p>Consider archiving this course to keep your course list organized.</p>
        
        <p style="text-align: center; margin-top: 30px;">
          <a href="${process.env.DOMAIN}/course/${course.id}/settings" 
             style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Manage Course Settings
          </a>
        </p>
      </div>
    `;

    await this.mailService.sendEmail({
      receiverOrReceivers: professorCourse.user.email,
      type: MailServiceType.WEEKLY_COURSE_SUMMARY,
      subject: `HelpMe - Consider Archiving: ${course.name}`,
      content: html,
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
