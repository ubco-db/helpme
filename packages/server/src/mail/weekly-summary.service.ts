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
import { UserModel } from '../profile/user.entity';
import { UserSubscriptionModel } from './user-subscriptions.entity';
import { MailServiceModel } from './mail-services.entity';
import { CalendarModel } from '../calendar/calendar.entity';
import { InsightsService } from '../insights/insights.service';
import {
  MostActiveStudents,
  AverageTimesByWeekDay,
  MostActiveTimes,
  StaffTotalHelped,
} from '../insights/insight-objects';
import { ChartOutputType, GanttChartOutputType, TableOutputType } from '@koh/common';
import {
  WeeklySummaryBuilder,
  ChatbotStats,
  AsyncQuestionStats,
  QueueStats,
  NewStudentData,
  TopStudentData,
  StaffPerformanceData,
  MostActiveDaysData,
  PeakHoursData,
  AsyncQuestionDetailData,
  RecommendationData,
  CourseStatsData,
} from './weekly-summary.builder';



@Injectable()
export class WeeklySummaryService {
  constructor(
    private mailService: MailService,
    private insightsService: InsightsService,
  ) {}

  // Run every week
  // Run every Monday at 9am
  @Cron('0 0 9 * * 1') 
  async sendWeeklySummaries() {
    const startTime = Date.now();

    try {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Get all professors with their courses
      const professorCourses = await UserCourseModel.createQueryBuilder('uc')
        .innerJoinAndSelect('uc.user', 'user')
        .innerJoinAndSelect('uc.course', 'course')
        .leftJoinAndSelect('course.semester', 'semester')
        .leftJoinAndSelect('course.courseSettings', 'courseSettings')
        .where('uc.role = :role', { role: Role.PROFESSOR })
        .andWhere('course.deletedAt IS NULL')
        .andWhere('course.enabled = :enabled', { enabled: true })
        .getMany();

      // Group courses by professor
      const professorMap = new Map<number, typeof professorCourses>();
      for (const pc of professorCourses) {
        if (!professorMap.has(pc.user.id)) {
          professorMap.set(pc.user.id, []);
        }
        professorMap.get(pc.user.id).push(pc);
      }

      let emailsSent = 0;
      let emailsFailed = 0;

      // Process each professor with all their courses
      for (const [professorId, courses] of professorMap.entries()) {
        const professor = courses[0].user;

        try {
          // Check if professor is subscribed to weekly summaries
          const mailService = await MailServiceModel.findOne({
            where: { serviceType: MailServiceType.WEEKLY_COURSE_SUMMARY },
          });

          if (mailService) {
            const subscription = await UserSubscriptionModel.findOne({
              where: {
                userId: professor.id,
                serviceId: mailService.id,
              },
            });

            // If subscription exists and isSubscribed is false, skip this professor
            if (subscription && !subscription.isSubscribed) {
              continue;
            }
          }

          // Gather statistics for all courses
          const courseStatsArray = [];
          for (const professorCourse of courses) {
            const chatbotStats = await this.getChatbotStats(
              professorCourse.courseId,
              lastWeek,
            );
            
            const newStudents = await this.getNewStudents(
              professorCourse.courseId,
              lastWeek,
            );
            
            const topStudents = await this.getTopActiveStudents(
              professorCourse.courseId,
              lastWeek,
            );
            
            const staffPerformance = await this.getStaffPerformance(
              professorCourse.courseId,
              lastWeek,
            );
            
            const mostActiveDays = await this.getMostActiveDays(
              professorCourse.courseId,
              lastWeek,
            );
            
            const peakHours = await this.getPeakHours(
              professorCourse.courseId,
              lastWeek,
            );
            
            let asyncStats: AsyncQuestionStats;
            let asyncQuestionsNeedingHelp: AsyncQuestionDetailData[] = [];
            try {
              asyncStats = await this.getAsyncQuestionStats(
                professorCourse.courseId,
                lastWeek,
              );
              asyncQuestionsNeedingHelp = await this.getAsyncQuestionsNeedingHelp(
                professorCourse.courseId,
              );
            } catch (error) {
              //Return empty stats if there's an error
              asyncStats = {
                total: 0,
                aiResolved: 0,
                humanAnswered: 0,
                stillNeedHelp: 0,
                withNewComments: 0,
                avgResponseTime: 0,
              };
              asyncQuestionsNeedingHelp = [];
            }

            let queueStats: QueueStats;
            try {
              queueStats = await this.getQueueStats(
                professorCourse.courseId,
                lastWeek,
              );
            } catch (error) {
              queueStats = {
                totalQuestions: 0,
                uniqueStudents: 0,
                avgWaitTime: null,
                avgHelpTime: null,
                queueNames: [],
              };
            }

            const hasActivity =
              chatbotStats.totalQuestions > 0 || asyncStats.total > 0 || queueStats.totalQuestions > 0;
            //If no activity, should suggest archiving
            if (!hasActivity) {
              const shouldSuggestArchive = await this.shouldSuggestArchiving(
                professorCourse.course,
              );
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
                asyncQuestionsNeedingHelp,
                queueStats,
                newStudents,
                topStudents,
                staffPerformance,
                mostActiveDays,
                peakHours,
                recommendations: [],
                suggestArchive: shouldSuggestArchive,
              });
            } else {
              const recommendations = await this.generateRecommendations(
                professorCourse.course,
                queueStats,
                asyncStats,
                peakHours,
                mostActiveDays,
              );
              
              courseStatsArray.push({
                course: professorCourse.course,
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
                suggestArchive: false,
              });
            }
          }

          //Build consolidated email with all courses
          const emailHtml = WeeklySummaryBuilder.buildConsolidatedEmail(
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
        } catch (error) {
          emailsFailed++;
          Sentry.captureException(error, {
            extra: {
              professorId,
              courseCount: courses.length,
            },
          });
        }
      }

      const duration = Date.now() - startTime;


    } catch (error) {
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
    try {
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
      const answeredQuestions = (questions || []).filter((q) => q && q.closedAt && q.createdAt);
      const avgResponseTime =
        answeredQuestions && answeredQuestions.length > 0
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
    } catch (error) {
      throw error;
    }
  }

  private async getAsyncQuestionsNeedingHelp(
    courseId: number,
  ): Promise<AsyncQuestionDetailData[]> {
    const questions = await AsyncQuestionModel.createQueryBuilder('aq')
      .select(['aq.id', 'aq.questionAbstract', 'aq.questionText', 'aq.status', 'aq.createdAt', 'aq.closedAt'])
      .where('aq.courseId = :courseId', { courseId })
      .andWhere('aq.closedAt IS NULL')
      .orderBy('aq.createdAt', 'ASC')
      .getMany();
    

    const now = new Date();
    return questions.map((q) => {
      const daysAgo = Math.floor((now.getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: q.id,
        abstract: q.questionAbstract || q.questionText?.substring(0, 100) || '(No content)',
        status: q.status,
        createdAt: q.createdAt,
        daysAgo,
      };
    });
  }

  private async getQueueStats(
    courseId: number,
    since: Date,
  ): Promise<QueueStats> {
    const questions = await QuestionModel.createQueryBuilder('q')
      .innerJoinAndSelect('q.queue', 'queue')
      .innerJoin('q.creator', 'creator')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .getMany();

    const totalQuestions = questions.length;
    const uniqueStudents = new Set(questions.map(q => q.creatorId)).size;
    const queueNames = [...new Set(
      questions
        .map(q => q.queue?.room)
        .filter(room => room != null && room !== '')
    )];


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
      queueNames,
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

    // Check if a course has had any activity in the past 4 weeks. If not, suggest archiving the course. 
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


    return recentInteractions === 0 && recentAsyncQuestions === 0 && recentQueueQuestions === 0;
  }

  private async getNewStudents(
    courseId: number,
    since: Date,
  ): Promise<NewStudentData[]> {
    const newStudentRecords = await UserCourseModel.createQueryBuilder('uc')
      .innerJoinAndSelect('uc.user', 'user')
      .where('uc.courseId = :courseId', { courseId })
      .andWhere('uc.role = :role', { role: Role.STUDENT })
      .andWhere('uc.createdAt >= :since', { since })
      .orderBy('user.lastName', 'ASC')
      .addOrderBy('user.firstName', 'ASC')
      .getMany();

    return newStudentRecords.map((uc) => ({
      id: uc.user.id,
      name: uc.user.name,
      email: uc.user.email,
      joinedAt: uc.createdAt,
    }));
  }


  private async getStaffPerformance(
    courseId: number,
    since: Date,
  ): Promise<StaffPerformanceData[]> {
    const insight = await this.insightsService.computeOutput({
      insight: StaffTotalHelped,
      filters: [
        { type: 'courseId', courseId },
        { type: 'timeframe', start: since, end: new Date() },
      ],
    });

    const chartData = insight as ChartOutputType;
    return chartData.data
      .map((item: any) => ({
        id: 0, 
        name: item.staffMember,
        questionsHelped: parseInt(item.Queue_Questions_Helped || 0),
        asyncQuestionsHelped: parseInt(item.Anytime_Questions_Helped || 0),
        avgHelpTime: null, 
      }))
      .sort((a, b) => (b.questionsHelped + b.asyncQuestionsHelped) - (a.questionsHelped + a.asyncQuestionsHelped));
  }

  private async getTopActiveStudents(
    courseId: number,
    since: Date,
  ): Promise<TopStudentData[]> {
    const insight = await this.insightsService.computeOutput({
      insight: MostActiveStudents,
      filters: [
        { type: 'courseId', courseId },
        { type: 'timeframe', start: since, end: new Date() },
      ],
    });

    const tableData = insight as TableOutputType;
    return tableData.data.map((item: any) => ({
      id: 0, 
      name: item.studentName,
      email: '', 
      questionsAsked: item.questionsAsked,
    }));
  }

  private async getMostActiveDays(
    courseId: number,
    since: Date,
  ): Promise<MostActiveDaysData> {
    //get question counts by day of week for queue questions
    const insight = await this.insightsService.computeOutput({
      insight: AverageTimesByWeekDay,
      filters: [
        { type: 'courseId', courseId },
        { type: 'timeframe', start: since, end: new Date() },
      ],
    });

    const chartData = insight as ChartOutputType;
    const byDayOfWeek = chartData.data.map((item: any) => ({
      day: item.weekday,
      count: parseInt(item.Total_Time || 0),
    }));

    let mostActiveDay = 'No activity';
    let maxCount = 0;
    //find most active day
    byDayOfWeek.forEach((dayData) => {
      if (dayData.count > maxCount) {
        maxCount = dayData.count;
        mostActiveDay = dayData.day;
      }
    });

    return {
      byDayOfWeek,
      mostActiveDay,
    };
  }

  private async getPeakHours(
    courseId: number,
    since: Date,
  ): Promise<PeakHoursData> {
    const insight = await this.insightsService.computeOutput({
      insight: MostActiveTimes,
      filters: [
        { type: 'courseId', courseId },
        { type: 'timeframe', start: since, end: new Date() },
      ],
    });

    const ganttData = insight as GanttChartOutputType;
    
    if (!ganttData.data || ganttData.data.length === 0) {
      return { peakHours: [], quietHours: [] };
    }

    const timeCountMap = new Map<number, number>();
    ganttData.data.forEach((item: any) => {
      const time = parseInt(item.time);
      const amount = parseInt(item.Amount);
      timeCountMap.set(time, (timeCountMap.get(time) || 0) + amount);
    });

    const totalCount = Array.from(timeCountMap.values()).reduce((a, b) => a + b, 0);
    const avgCount = totalCount / timeCountMap.size;
    const peakHours: string[] = [];
    const quietHours: string[] = [];

    const formatHour = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const suffix = hours < 12 ? 'am' : 'pm';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, '0')}${suffix}`;
    };

    timeCountMap.forEach((count, time) => {
      if (count > avgCount * 1.2) {
        peakHours.push(formatHour(time));
      } else if (count < avgCount * 0.5) {
        const hour = Math.floor(time / 60);
        if (hour >= 8 && hour <= 22) {
          quietHours.push(formatHour(time));
        }
      }
    });

    return { peakHours, quietHours };
  }

  private async generateRecommendations(
    course: CourseModel,
    queueStats: QueueStats,
    asyncStats: AsyncQuestionStats,
    peakHours: PeakHoursData,
    mostActiveDays: MostActiveDaysData,
  ): Promise<RecommendationData[]> {
    const recommendations: RecommendationData[] = [];

    if (course.courseSettings?.chatBotEnabled !== false && course.courseSettings?.asyncQueueEnabled === false) {
      recommendations.push({
        type: 'info',
        message: `This course's Chatbot feature is enabled but the Anytime Question feature is disabled. It is strongly recommended to <a href="${process.env.DOMAIN}/course/${course.id}/settings" style="color: #17a2b8; text-decoration: underline; font-weight: bold;">enable the Anytime Questions feature</a> to allow students to get human feedback/discussion from their conversations with the Chatbot.`,
      });
    }

    // Check if course has queues but no calendar events with staff assigned
    if (course.courseSettings?.queueEnabled !== false && queueStats.totalQuestions > 0) {
      // Find calendar events for this course that have at least one staff member assigned
      const calendarEventsWithStaff = await CalendarModel.createQueryBuilder('calendar')
        .innerJoin('calendar.staff', 'staff')
        .where('calendar.course = :courseId', { courseId: course.id })
        .getCount();

      if (calendarEventsWithStaff === 0) {
        recommendations.push({
          type: 'warning',
          message: `This course has queues but no <a href="${process.env.DOMAIN}/course/${course.id}/schedule" style="color: #ffc107; text-decoration: underline; font-weight: bold;">calendar events with staff members assigned</a>. 
          Consider creating calendar events with staff members assigned, as this will allow them to be automatically checked out. Thus, students will not join a queue thinking that there is still an ongoing session when the TA has already left.`,
        });
      }
    }

    // Check for high wait times
    if (queueStats.avgWaitTime !== null && queueStats.avgWaitTime > 30) {
      recommendations.push({
        type: 'warning',
        message: `Average wait time is ${queueStats.avgWaitTime.toFixed(1)} minutes. Consider adding more office hours${peakHours.peakHours.length > 0 ? ` during peak times (${peakHours.peakHours.slice(0, 3).join(', ')})` : ''}.`,
      });
    }

    // Check for good performance
    if (queueStats.avgWaitTime !== null && queueStats.avgWaitTime < 10 && queueStats.totalQuestions > 10) {
      recommendations.push({
        type: 'success',
        message: 'Response time is excellent. No recommendations needed.',
      });
    }

    return recommendations;
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
