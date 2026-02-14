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
import { UserModel } from '../profile/user.entity';

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

interface NewStudentData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: Date;
}

interface TopStudentData {
  id: number;
  name: string;
  email: string;
  questionsAsked: number;
}

interface StaffPerformanceData {
  id: number;
  name: string;
  questionsHelped: number;
  asyncQuestionsHelped: number;
  avgHelpTime: number | null; // in minutes
}

interface MostActiveDaysData {
  byDayOfWeek: { day: string; count: number }[];
  mostActiveDay: string;
}

interface PeakHoursData {
  peakHours: string[];
  quietHours: string[];
}

interface RecommendationData {
  type: 'warning' | 'info' | 'success';
  message: string;
}

@Injectable()
export class WeeklySummaryService {
  constructor(private mailService: MailService) {}

  // Run every week
  @Cron(CronExpression.EVERY_MINUTE) 
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
            console.log(`Looking for students who joined after: ${lastWeek.toISOString()}`); // DEBUG
            
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
            try {
              asyncStats = await this.getAsyncQuestionStats(
                professorCourse.courseId,
                lastWeek,
              );
            } catch (error) {
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
                newStudents,
                topStudents,
                staffPerformance,
                mostActiveDays,
                peakHours,
                recommendations: [],
                suggestArchive: shouldSuggestArchive,
              });
            } else {
              const recommendations = this.generateRecommendations(
                queueStats,
                asyncStats,
                peakHours,
                mostActiveDays,
              );
              
              courseStatsArray.push({
                course: professorCourse.course,
                chatbotStats,
                asyncStats,
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

    console.log(`New students for course ${courseId} since ${since}:`, newStudentRecords.length); // DEBUG
    newStudentRecords.forEach(uc => {
      console.log(`  - ${uc.user.firstName} ${uc.user.lastName} (${uc.user.email}) joined at ${uc.createdAt}`); // DEBUG
    });

    return newStudentRecords.map((uc) => ({
      id: uc.user.id,
      firstName: uc.user.firstName,
      lastName: uc.user.lastName,
      email: uc.user.email,
      joinedAt: uc.createdAt,
    }));
  }


  private async getStaffPerformance(
    courseId: number,
    since: Date,
  ): Promise<StaffPerformanceData[]> {
    // Get queue questions helped by each staff member
    const queueHelped = await QuestionModel.createQueryBuilder('q')
      .select('q.taHelpedId', 'staffId')
      .addSelect('COUNT(q.id)', 'count')
      .addSelect('AVG(q.helpTime)', 'avgHelpTime')
      .innerJoin('q.queue', 'queue')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.taHelpedId IS NOT NULL')
      .andWhere('q.createdAt >= :since', { since })
      .andWhere('q.status = :status', { status: 'Resolved' })
      .groupBy('q.taHelpedId')
      .getRawMany();

    // Get async questions helped by each staff member
    const asyncHelped = await AsyncQuestionModel.createQueryBuilder('aq')
      .select('aq.taHelpedId', 'staffId')
      .addSelect('COUNT(aq.id)', 'count')
      .where('aq.courseId = :courseId', { courseId })
      .andWhere('aq.taHelpedId IS NOT NULL')
      .andWhere('aq.createdAt >= :since', { since })
      .andWhere('aq.status = :status', { status: 'HumanAnswered' })
      .groupBy('aq.taHelpedId')
      .getRawMany();

    const staffIds = [...new Set([
      ...queueHelped.map(q => q.staffId),
      ...asyncHelped.map(a => a.staffId),
    ])];

    if (staffIds.length === 0) {
      return [];
    }
    const staffNames = await UserModel.createQueryBuilder('u')
      .select('u.id', 'id')
      .addSelect("u.firstName || ' ' || u.lastName", 'name')
      .where('u.id IN (:...ids)', { ids: staffIds })
      .getRawMany();

    return staffIds.map(staffId => {
      const queueData = queueHelped.find(q => q.staffId === staffId);
      const asyncData = asyncHelped.find(a => a.staffId === staffId);
      const staff = staffNames.find(s => s.id === staffId);

      return {
        id: staffId,
        name: staff?.name || `ID ${staffId}`,
        questionsHelped: parseInt(queueData?.count || '0'),
        asyncQuestionsHelped: parseInt(asyncData?.count || '0'),
        avgHelpTime: queueData?.avgHelpTime ? parseFloat(queueData.avgHelpTime) / 60 : null, // Convert seconds to minutes
      };
    }).sort((a, b) => (b.questionsHelped + b.asyncQuestionsHelped) - (a.questionsHelped + a.asyncQuestionsHelped));
  }

  private async getTopActiveStudents(
    courseId: number,
    since: Date,
  ): Promise<TopStudentData[]> {
    // Get top 5 students by queue questions asked
    const results = await QuestionModel.createQueryBuilder('q')
      .select('q.creatorId', 'id')
      .addSelect('u.name', 'name')
      .addSelect('u.email', 'email')
      .addSelect('COUNT(*)', 'questionsAsked')
      .innerJoin('q.queue', 'queue')
      .innerJoin('q.creator', 'u')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .groupBy('q.creatorId')
      .addGroupBy('u.name')
      .addGroupBy('u.email')
      .orderBy('COUNT(*)', 'DESC')
      .limit(5)
      .getRawMany();

    return results.map((r) => ({
      id: r.id,
      name: r.name || 'Unknown Student',
      email: r.email,
      questionsAsked: parseInt(r.questionsAsked),
    }));
  }

  private async getMostActiveDays(
    courseId: number,
    since: Date,
  ): Promise<MostActiveDaysData> {
    //get question counts by day of week for queue questions
    const results = await QuestionModel.createQueryBuilder('q')
      .select("EXTRACT(DOW FROM q.createdAt)", 'dayOfWeek')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('q.queue', 'queue')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .groupBy("EXTRACT(DOW FROM q.createdAt)")
      .getRawMany();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek = dayNames.map(day => ({ day, count: 0 }));
    
    results.forEach((result) => {
      const dayIndex = parseInt(result.dayOfWeek);
      byDayOfWeek[dayIndex].count = parseInt(result.count);
    });
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
    //similar logic to most active days but group by hours
    const results = await QuestionModel.createQueryBuilder('q')
      .select("EXTRACT(HOUR FROM q.createdAt)", 'hour')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('q.queue', 'queue')
      .where('queue.courseId = :courseId', { courseId })
      .andWhere('q.createdAt >= :since', { since })
      .groupBy("EXTRACT(HOUR FROM q.createdAt)")
      .getRawMany();

    if (results.length === 0) {
      return { peakHours: [], quietHours: [] };
    }

    const totalCount = results.reduce((sum, r) => sum + parseInt(r.count), 0);
    const avgCount = totalCount / results.length;
    const peakHours: string[] = [];
    const quietHours: string[] = [];

    results.forEach((result) => {
      const hour = parseInt(result.hour);
      const count = parseInt(result.count);
      
      const formatHour = (h: number): string => {
        if (h === 0) return '12am';
        if (h < 12) return `${h}am`;
        if (h === 12) return '12pm';
        return `${h - 12}pm`;
      };

      if (count > avgCount * 1.2) { 
        peakHours.push(formatHour(hour));
      } else if (count < avgCount * 0.5 && hour >= 8 && hour <= 22) { 
        quietHours.push(formatHour(hour));
      }
    });

    return { peakHours, quietHours };
  }

  private generateRecommendations(
    queueStats: QueueStats,
    asyncStats: AsyncQuestionStats,
    peakHours: PeakHoursData,
    mostActiveDays: MostActiveDaysData,
  ): RecommendationData[] {
    const recommendations: RecommendationData[] = [];

    // Check for unanswered async questions
    if (asyncStats.stillNeedHelp > 0) {
      recommendations.push({
        type: 'warning',
        message: `${asyncStats.stillNeedHelp} async question${asyncStats.stillNeedHelp !== 1 ? 's' : ''} still need${asyncStats.stillNeedHelp === 1 ? 's' : ''} attention from staff.`,
      });
    }

    // Check for high wait times
    if (queueStats.avgWaitTime !== null && queueStats.avgWaitTime > 30) {
      recommendations.push({
        type: 'warning',
        message: `Average wait time is ${queueStats.avgWaitTime.toFixed(1)} minutes. Consider adding more office hours${peakHours.peakHours.length > 0 ? ` during peak times (${peakHours.peakHours.slice(0, 3).join(', ')})` : ''}.`,
      });
    }

    // Check for low engagement
    if (queueStats.totalQuestions > 0 && queueStats.totalQuestions < 5) {
      recommendations.push({
        type: 'info',
        message: 'Queue usage is low. Consider reminding students about office hours availability.',
      });
    }

    // Check for good performance
    if (queueStats.avgWaitTime !== null && queueStats.avgWaitTime < 10 && queueStats.totalQuestions > 10) {
      recommendations.push({
        type: 'success',
        message: 'Response time is excellent. No recommendations needed.',
      });
    }

    // Suggest best times for office hours based on activity
    if (mostActiveDays.mostActiveDay !== 'No activity' && mostActiveDays.byDayOfWeek.some(d => d.count > 0)) {
      const activeDays = mostActiveDays.byDayOfWeek
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(d => d.day);
      
      if (activeDays.length > 0) {
        recommendations.push({
          type: 'info',
          message: `Most active day${activeDays.length > 1 ? 's' : ''}: ${activeDays.join(', ')}. Consider adding more office hours on these days.`,
        });
      }
    }

    return recommendations;
  }

  
  private buildConsolidatedWeeklySummaryEmail(
    courseStatsArray: Array<{
      course: CourseModel;
      chatbotStats: ChatbotStats;
      asyncStats: AsyncQuestionStats;
      queueStats: QueueStats;
      newStudents: NewStudentData[];
      topStudents: TopStudentData[];
      staffPerformance: StaffPerformanceData[];
      mostActiveDays: MostActiveDaysData;
      peakHours: PeakHoursData;
      recommendations: RecommendationData[];
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
      const { course, chatbotStats, asyncStats, queueStats, newStudents, topStudents, staffPerformance, mostActiveDays, peakHours, recommendations, suggestArchive } = courseData;


      html += `
        <div style="background-color: #f8f9fa; border-left: 4px solid #3498db; padding: 20px; margin-bottom: 30px; border-radius: 5px;">
          <h2 style="color: #2c3e50; margin-top: 0;">${course.name}</h2>
      `;

      // New Students Section (show for all courses, even inactive ones)
      if (newStudents.length > 0) {
        html += `
          <div style="background-color: #e8f5e9; border: 1px solid #4caf50; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="color: #2e7d32; margin-top: 0;">New Students This Week</h3>
            <p style="color: #2e7d32; margin-bottom: 10px;">
              <strong>${newStudents.length}</strong> new student${newStudents.length !== 1 ? 's' : ''} joined this course:
            </p>
            <ul style="line-height: 1.6; color: #1b5e20; margin-bottom: 10px;">
        `;
        
        newStudents.forEach((student) => {
          html += `
              <li><strong>${student.firstName} ${student.lastName}</strong> (${student.email})</li>
          `;
        });
        
        html += `
            </ul>
            <p style="color: #2e7d32; font-size: 14px; margin: 10px 0 0 0;">
              <em>If any of these students should not be in the course, please remove them from the course under Course Roster and either disable or change the course invite link under Course Settings.</em>
            </p>
          </div>
        `;
      }

      if (suggestArchive) {
        html += `
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h3 style="color: #856404; margin-top: 0;">Consider Archiving This Course</h3>
            <p style="color: #856404; margin-bottom: 0;">
              No activity in the past 4 weeks. You may want to archive this course if the semester has ended.
            </p>
          </div>
        `;
        html += `
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

        // Most Active Days Section - show if there's any queue activity
        if (queueStats.totalQuestions > 0 && mostActiveDays.byDayOfWeek.some(d => d.count > 0)) {
          const totalQuestions = mostActiveDays.byDayOfWeek.reduce((sum, d) => sum + d.count, 0);
          html += `
            <h3 style="color: #16a085; margin-top: 20px;">📅 Most Active Days</h3>
            <p style="color: #7f8c8d; margin-bottom: 10px;">Queue activity by day of the week:</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          `;

          mostActiveDays.byDayOfWeek.forEach((dayData) => {
            if (dayData.count > 0) {
              const barWidth = Math.max(
                (dayData.count / totalQuestions) * 100,
                5,
              );
              html += `
                <tr>
                  <td style="padding: 5px; width: 100px; color: #34495e; font-weight: ${dayData.day === mostActiveDays.mostActiveDay ? 'bold' : 'normal'};">${dayData.day}:</td>
                  <td style="padding: 5px;">
                    <div style="background-color: ${dayData.day === mostActiveDays.mostActiveDay ? '#16a085' : '#95a5a6'}; height: 20px; width: ${barWidth}%; display: inline-block; border-radius: 3px;"></div>
                    <span style="margin-left: 10px; color: #34495e; font-weight: ${dayData.day === mostActiveDays.mostActiveDay ? 'bold' : 'normal'};">${dayData.count}</span>
                  </td>
                </tr>
              `;
            }
          });

          html += `
            </table>
            <p style="color: #16a085; font-size: 14px; margin: 0;"><strong>Busiest day:</strong> ${mostActiveDays.mostActiveDay}</p>
          `;
        }

        // Peak Hours Section - show if there's queue activity and peak hours identified
        if (queueStats.totalQuestions > 0 && (peakHours.peakHours.length > 0 || peakHours.quietHours.length > 0)) {
          html += `
            <h3 style="color: #e67e22; margin-top: 20px;">🕐 Peak Hours</h3>
          `;

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
        }
      }

      // Top Active Students Section
      if (topStudents.length > 0) {
        html += `
          <h3 style="color: #f39c12; margin-top: 20px;">⭐ Most Active Students</h3>
          <p style="color: #7f8c8d; margin-bottom: 10px;">Top students by questions asked this week:</p>
          <ol style="line-height: 1.8; color: #34495e;">
        `;
        
        topStudents.forEach((student) => {
          html += `
            <li><strong>${student.name}</strong> - ${student.questionsAsked} question${student.questionsAsked !== 1 ? 's' : ''}</li>
          `;
        });
        
        html += `
          </ol>
        `;
      }

      // Staff Performance Section
      if (staffPerformance.length > 0) {
        html += `
          <h3 style="color: #8e44ad; margin-top: 20px;">👥 Staff Performance</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #ecf0f1;">
                <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Staff Member</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Queue Questions</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Async Questions</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Avg Help Time</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        staffPerformance.forEach((staff) => {
          const totalHelped = staff.questionsHelped + staff.asyncQuestionsHelped;
          html += `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${staff.name}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.questionsHelped}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.asyncQuestionsHelped}</td>
                <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">${staff.avgHelpTime !== null ? staff.avgHelpTime.toFixed(1) + ' min' : 'N/A'}</td>
              </tr>
          `;
        });
        
        html += `
            </tbody>
          </table>
        `;
      }

      if (recommendations.length > 0) {
        html += `
          <h3 style="color: #2980b9; margin-top: 20px;">💡 Recommendations</h3>
        `;

        recommendations.forEach((rec) => {
          let bgColor, borderColor, icon;
          
          if (rec.type === 'warning') {
            bgColor = '#fff3cd';
            borderColor = '#ffc107';
            icon = '⚠️';
          } else if (rec.type === 'success') {
            bgColor = '#d4edda';
            borderColor = '#28a745';
            icon = '✅';
          } else {
            bgColor = '#d1ecf1';
            borderColor = '#17a2b8';
            icon = 'ℹ️';
          }

          html += `
          <div style="background-color: ${bgColor}; border-left: 4px solid ${borderColor}; padding: 12px; margin-bottom: 10px; border-radius: 3px;">
            <p style="margin: 0; color: #34495e;"><strong>${icon}</strong> ${rec.message}</p>
          </div>
          `;
        });
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
