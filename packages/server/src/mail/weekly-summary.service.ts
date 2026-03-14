import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from './mail.service';
import { UserCourseModel } from '../profile/user-course.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { QuestionModel } from '../question/question.entity';
import { CourseModel } from '../course/course.entity';
import { MailServiceType, Role, asyncQuestionStatus } from '@koh/common';
import { MoreThanOrEqual } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { UserModel } from '../profile/user.entity';
import { UserSubscriptionModel } from './user-subscriptions.entity';
import { MailServiceModel } from './mail-services.entity';
import { CalendarModel } from '../calendar/calendar.entity';
import { InsightsService } from '../insights/insights.service';
import {
  MostActiveStudents,
  MostActiveTimes,
  StaffTotalHelped,
  StaffEfficiency,
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

  // Run every Monday at midnight
  @Cron('0 0 0 * * 1')  
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

      // Pre-calculated statistics for each course to avoid repeating the same calculations when multiple professors have the same course
      const courseStatsCache = new Map<number, CourseStatsData>();
      const uniqueCourseEntries = new Map<number, { courseId: number; course: CourseModel }>();
      for (const courses of professorMap.values()) {
        for (const pc of courses) {
          if (!uniqueCourseEntries.has(pc.courseId)) {
            uniqueCourseEntries.set(pc.courseId, { courseId: pc.courseId, course: pc.course });
          }
        }
      }

      for (const [courseId, { course }] of uniqueCourseEntries.entries()) {
        try {
          const chatbotStats = await this.getChatbotStats(courseId, lastWeek);
          const newStudents = await this.getNewStudents(courseId, lastWeek);
          const topStudents = await this.getTopActiveStudents(courseId, lastWeek);
          const staffPerformance = await this.getStaffPerformance(courseId, lastWeek);
          const mostActiveDays = await this.getMostActiveDays(courseId, lastWeek);
          const peakHours = await this.getPeakHours(courseId, lastWeek);

          let asyncStats: AsyncQuestionStats;
          let asyncQuestionsNeedingHelp: AsyncQuestionDetailData[] = [];
          try {
            asyncStats = await this.getAsyncQuestionStats(courseId, lastWeek);
            asyncQuestionsNeedingHelp = await this.getAsyncQuestionsNeedingHelp(courseId);
          } catch (error) {
            console.error(
              `[WeeklySummary] Failed to get async question stats for course ${courseId}:`,
              error,
            );
            Sentry.captureException(error, {
              extra: { courseId, section: 'asyncQuestionStats' },
            });
            asyncStats = {
              total: 0,
              aiResolved: 0,
              humanAnswered: 0,
              stillNeedHelp: 0,
              withNewComments: 0,
              avgResponseTime: 0,
              byDayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({ day, count: 0 })),
              mostActiveDay: 'N/A',
            };
            asyncQuestionsNeedingHelp = [];
          }

          let queueStats: QueueStats;
          try {
            queueStats = await this.getQueueStats(courseId, lastWeek);
          } catch (error) {
            console.error(
              `[WeeklySummary] Failed to get queue stats for course ${courseId}:`,
              error,
            );
            Sentry.captureException(error, {
              extra: { courseId, section: 'queueStats' },
            });
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

          let recommendations: RecommendationData[] = [];
          let suggestArchive = false;

          if (!hasActivity) {
            suggestArchive = await this.shouldSuggestArchiving(course);
          } else {
            recommendations = await this.generateRecommendations(
              course,
              queueStats,
              asyncStats,
              peakHours,
              mostActiveDays,
            );
          }

          courseStatsCache.set(courseId, {
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
          });
        } catch (error) {
          console.error(
            `[WeeklySummary] Failed to compute stats for course ${courseId}:`,
            error,
          );
          Sentry.captureException(error, {
            extra: { courseId, section: 'courseStatsComputation' },
          });
        }
      }

      // Send emails to each professor, reusing pre-calculated course statistics
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

          // Look up pre-computed stats for each of this professor's courses
          const courseStatsArray: CourseStatsData[] = [];
          for (const professorCourse of courses) {
            const cached = courseStatsCache.get(professorCourse.courseId);
            if (cached) {
              courseStatsArray.push(cached);
            }
          }

          if (courseStatsArray.length === 0) {
            continue;
          }

          //Build consolidated email with all courses
          const emailHtml = WeeklySummaryBuilder.buildConsolidatedEmail(
            courseStatsArray,
            lastWeek,
          );

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
          console.error(
            `[WeeklySummary] Failed to send email for professor ${professorId} (${courses.length} courses):`,
            error,
          );
          Sentry.captureException(error, {
            extra: {
              professorId,
              courseCount: courses.length,
              courseIds: courses.map((c) => c.courseId),
            },
          });
        }
      }

      const duration = Date.now() - startTime;
      const durationSeconds = (duration / 1000).toFixed(1);

      console.log(
        `[WeeklySummary] Sent ${emailsSent} emails (${emailsFailed} failed) for Weekly Summary cron job. Took ${durationSeconds}s.`,
      );

      if (duration > 60000) {
        Sentry.captureMessage(
          `Weekly Summary cron job took ${durationSeconds}s to complete (${emailsSent} sent, ${emailsFailed} failed)`,
          'warning',
        );
      }
    } catch (error) {
      console.error(
        `[WeeklySummary] Fatal error in sendWeeklySummaries:`,
        error,
      );
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
      (q) => q.aiAnswerText && q.status === asyncQuestionStatus.AIAnsweredResolved,
    ).length;
    const humanAnswered = questions.filter(
      (q) => q.answerText && q.status === asyncQuestionStatus.HumanAnswered,
    ).length;
    const stillNeedHelp = questions.filter(
      (q) => q.status === asyncQuestionStatus.AIAnswered || q.status === asyncQuestionStatus.AIAnsweredNeedsAttention,
    ).length;
    const withNewComments = questions.filter((q) =>
      q.comments?.some((c) => c.createdAt >= since),
    ).length;

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

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = new Array(7).fill(0);
    questions.forEach((q) => {
      const dayOfWeek = new Date(q.createdAt).getDay();
      dayCounts[dayOfWeek]++;
    });
    const byDayOfWeek = dayNames.map((day, index) => ({ day, count: dayCounts[index] }));

    let mostActiveDay = 'No activity';
    let maxCount = 0;
    byDayOfWeek.forEach((d) => {
      if (d.count > maxCount) {
        maxCount = d.count;
        mostActiveDay = d.day;
      }
    });

    return {
      total,
      aiResolved,
      humanAnswered,
      stillNeedHelp,
      withNewComments,
      avgResponseTime,
      byDayOfWeek,
      mostActiveDay,
    };
  }

  private async getAsyncQuestionsNeedingHelp(
    courseId: number,
  ): Promise<AsyncQuestionDetailData[]> {
    const questions = await AsyncQuestionModel.createQueryBuilder('aq')
      .select(['aq.id', 'aq.questionAbstract', 'aq.questionText', 'aq.status', 'aq.createdAt', 'aq.closedAt'])
      .where('aq.courseId = :courseId', { courseId })
      .andWhere('aq.status IN (:...statuses)', { statuses: [asyncQuestionStatus.AIAnswered, asyncQuestionStatus.AIAnsweredNeedsAttention] })
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
    const filters = [
      { type: 'courseId' as const, courseId },
      { type: 'timeframe' as const, start: since, end: new Date() },
    ];

    const totalHelpedInsight = await this.insightsService.computeOutput({
      insight: StaffTotalHelped,
      filters,
    });

    const efficiencyInsight = await this.insightsService.computeOutput({
      insight: StaffEfficiency,
      filters,
    });

    const totalHelpedData = (totalHelpedInsight as ChartOutputType).data;
    const efficiencyData = (efficiencyInsight as ChartOutputType).data;

    const efficiencyMap = new Map<string, { avgHelpTime: number }>();
    efficiencyData.forEach((item: any) => {
      efficiencyMap.set(item.staffMember, {
        avgHelpTime: parseFloat(item.Average_Help_Time),
      });
    });

    return totalHelpedData
      .map((item: any) => {
        const efficiency = efficiencyMap.get(item.staffMember);
        return {
          id: 0,
          name: item.staffMember,
          questionsHelped: parseInt(item.Queue_Questions_Helped || 0),
          asyncQuestionsHelped: parseInt(item.Anytime_Questions_Helped || 0),
          avgHelpTime: efficiency?.avgHelpTime ?? null,
        };
      })
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
    const questions = await QuestionModel.createQueryBuilder('q')
      .innerJoin('q.queue', 'queue')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .getMany();

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

    questions.forEach((q) => {
      const dayOfWeek = new Date(q.createdAt).getDay();
      dayCounts[dayOfWeek]++;
    });

    const byDayOfWeek = dayNames.map((day, index) => ({
      day,
      count: dayCounts[index],
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
      return { peakHours: [] };
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

    const formatHour = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const suffix = hours < 12 ? 'am' : 'pm';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, '0')}${suffix}`;
    };

    const sortedTimes = Array.from(timeCountMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const maxCount = sortedTimes[0][1];
    const minCount = sortedTimes[sortedTimes.length - 1][1];

    if (maxCount > minCount) {
      sortedTimes.forEach(([time, count]) => {
        if (count > avgCount) {
          peakHours.push(formatHour(time));
        }
      });
    } else {
      sortedTimes.forEach(([time]) => {
        peakHours.push(formatHour(time));
      });
    }

    return { peakHours };
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
        message: `Average wait time is ${queueStats.avgWaitTime.toFixed(1)} minutes. Consider having longer queue sessions or add additional staff, if possible.`,
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