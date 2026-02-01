import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from './mail.service';
import { UserCourseModel } from '../profile/user-course.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { QuestionModel } from '../question/question.entity';
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

interface QueueStats {
  totalQuestions: number;
  uniqueStudents: number;
  avgWaitTime: number | null;
  avgHelpTime: number | null;
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

      
     // TO REMOVE
      console.log(
        `Found ${professorCourses.length} professor-course relationships`,
      );
      console.log('Courses found:', professorCourses.map(pc => `${pc.course.name} (ID: ${pc.courseId}, enabled: ${pc.course.enabled})`).join(', '));

      // Group courses by professor
      const professorMap = new Map<number, typeof professorCourses>();
      for (const pc of professorCourses) {
        if (!professorMap.has(pc.user.id)) {
          professorMap.set(pc.user.id, []);
        }
        professorMap.get(pc.user.id).push(pc);
      }


      console.log(`Grouped into ${professorMap.size} unique professors`); // TO REMOVE
      for (const [profId, courses] of professorMap.entries()) {
        const prof = courses[0].user;
        console.log(`  Professor ${prof.email}: ${courses.map(c => c.course.name).join(', ')}`); // TO REMOVE
      }

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
            console.log(`Processing course: ${professorCourse.course.name} (ID: ${professorCourse.courseId})`); // TO REMOVE
            
            const chatbotStats = await this.getChatbotStats(
              professorCourse.courseId,
              lastWeek,
            );
            
            // Wrap async stats in try-catch to handle data issues
            let asyncStats: AsyncQuestionStats;
            try {
              asyncStats = await this.getAsyncQuestionStats(
                professorCourse.courseId,
                lastWeek,
              );
            } catch (error) {
              //TODO: Remove logging after debugging
              console.error(`Failed to get async stats for course ${professorCourse.courseId}:`, error.message); 
              console.error('Stack trace:', error.stack);
              // Return empty stats if there's an error
              asyncStats = {
                total: 0,
                aiResolved: 0,
                humanAnswered: 0,
                stillNeedHelp: 0,
                withNewComments: 0,
                avgResponseTime: 0,
              };
            }

            let queueStats: QueueStats;
            try {
              queueStats = await this.getQueueStats(
                professorCourse.courseId,
                lastWeek,
              );
            } catch (error) {
              console.error(`Failed to get queue stats for course ${professorCourse.courseId}:`, error.message);
              queueStats = {
                totalQuestions: 0,
                uniqueStudents: 0,
                avgWaitTime: null,
                avgHelpTime: null,
              };
            }

            const hasActivity =
              chatbotStats.totalQuestions > 0 || asyncStats.total > 0 || queueStats.totalQuestions > 0;
            
            // REMOVE
            console.log(`  Chatbot: ${chatbotStats.totalQuestions} questions, ${chatbotStats.uniqueStudents} students`);
            console.log(`  Async: ${asyncStats.total} questions`);
            console.log(`  Queue: ${queueStats.totalQuestions} questions, ${queueStats.uniqueStudents} students`);
            console.log(`  Has activity: ${hasActivity}`);

            // If no activity, check if should suggest archiving
            if (!hasActivity) {
              const shouldSuggestArchive = await this.shouldSuggestArchiving(
                professorCourse.course,
              );
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
                queueStats,
                suggestArchive: shouldSuggestArchive,
              });
            } else {
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
                queueStats,
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
    const questions = (await AsyncQuestionModel.createQueryBuilder('aq')
      .leftJoinAndSelect('aq.comments', 'comments')
      .where('aq.courseId = :courseId', { courseId })
      .andWhere('aq.createdAt >= :since', { since })
      .getMany()) || [];

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
    const answeredQuestions = questions.filter((q) => q.closedAt && q.createdAt) || [];
    const avgResponseTime =
      answeredQuestions.length > 0
        ? answeredQuestions.reduce(
            (sum, q) => {
              const closedTime = q.closedAt.getTime();
              const createdTime = new Date(q.createdAt).getTime();
              return sum + (closedTime - createdTime) / (1000 * 60 * 60);
            },
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

  private async getQueueStats(
    courseId: number,
    since: Date,
  ): Promise<QueueStats> {
    const questions = await QuestionModel.createQueryBuilder('q')
      .innerJoin('q.queue', 'queue')
      .innerJoin('q.creator', 'creator')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .getMany();

    const totalQuestions = questions.length;
    const uniqueStudents = new Set(questions.map(q => q.creatorId)).size;

    const questionsWithWait = questions.filter(q => q.waitTime > 0);
    const avgWaitTime = questionsWithWait.length > 0
      ? questionsWithWait.reduce((sum, q) => sum + q.waitTime, 0) / questionsWithWait.length / 60
      : null;

    const questionsWithHelp = questions.filter(q => q.helpTime > 0);
    const avgHelpTime = questionsWithHelp.length > 0
      ? questionsWithHelp.reduce((sum, q) => sum + q.helpTime, 0) / questionsWithHelp.length / 60
      : null;

    return {
      totalQuestions,
      uniqueStudents,
      avgWaitTime,
      avgHelpTime,
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
        console.log(`  ${course.name}: Semester ended on ${semesterEndDate}`);
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

    // Check for recent queue questions
    const recentQueueQuestions = await QuestionModel.createQueryBuilder('q')
      .innerJoin('q.queue', 'queue')
      .where('queue.courseId = :courseId', { courseId: course.id })
      .andWhere('q.createdAt >= :since', { since: fourWeeksAgo })
      .getCount();

    // console.log(`  ${course.name} activity check (last 4 weeks): Chatbot=${recentInteractions}, Async=${recentAsyncQuestions}, Queue=${recentQueueQuestions}`);

    return recentInteractions === 0 && recentAsyncQuestions === 0 && recentQueueQuestions === 0;
  }

  private buildConsolidatedWeeklySummaryEmail(
    courseStatsArray: Array<{
      course: CourseModel;
      chatbotStats: ChatbotStats;
      asyncStats: AsyncQuestionStats;
      queueStats: QueueStats;
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
      const { course, chatbotStats, asyncStats, queueStats, suggestArchive } = courseData;

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

      const hasActivity = chatbotStats.totalQuestions > 0 || asyncStats.total > 0 || queueStats.totalQuestions > 0;

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

        // Queue Questions Section
        if (queueStats.totalQuestions > 0) {
          html += `
            <h3 style="color: #9b59b6; margin-top: 20px;">Office Hours Queue</h3>
            <ul style="line-height: 1.8; color: #34495e;">
              <li><strong>${queueStats.totalQuestions}</strong> questions from <strong>${queueStats.uniqueStudents}</strong> unique student${queueStats.uniqueStudents !== 1 ? 's' : ''}</li>
          `;

          if (queueStats.avgWaitTime !== null) {
            html += `
              <li>Average wait time: <strong>${queueStats.avgWaitTime.toFixed(1)}</strong> minutes</li>
            `;
          }

          if (queueStats.avgHelpTime !== null) {
            html += `
              <li>Average help time: <strong>${queueStats.avgHelpTime.toFixed(1)}</strong> minutes</li>
            `;
          }

          html += `
            </ul>
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

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
