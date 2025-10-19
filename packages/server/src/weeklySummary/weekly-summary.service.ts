import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../mail/mail.service';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { InteractionModel } from '../chatbot/interaction.entity';
import { AsyncQuestionModel } from '../asyncQuestion/asyncQuestion.entity';
import { AsyncQuestionCommentModel } from '../asyncQuestion/asyncQuestionComment.entity';
import { asyncQuestionStatus, Role, MailServiceType } from '@koh/common';
import { Between, MoreThanOrEqual, Not } from 'typeorm';
import * as Sentry from '@sentry/browser';

export interface WeeklySummaryData {
  courseId: number;
  courseName: string;
  professorEmail: string;
  semesterName?: string;
  isActive: boolean;
  chatbotUsage: {
    totalInteractions: number;
    uniqueStudents: number;
    dailyBreakdown: { [key: string]: number };
    averageScore: number;
  };
  asyncQuestions: {
    total: number;
    aiAnswered: number;
    aiAnsweredResolved: number;
    aiAnsweredNeedsAttention: number;
    humanAnswered: number;
    stillNeedHelp: number;
    newComments: number;
    recentQuestions: Array<{
      id: number;
      questionAbstract: string;
      status: string;
      createdAt: Date;
      hasNewComments: boolean;
    }>;
  };
  recommendations: string[];
}

@Injectable()
export class WeeklySummaryService {
  constructor(private mailService: MailService) {}

  @Cron('0 8 * * 1')
  async sendWeeklySummaries(): Promise<void> {
    try {
      console.log('Starting weekly summary email generation...');
      
      const startOfWeek = this.getStartOfWeek();
      const endOfWeek = this.getEndOfWeek();
      
      // Get all active courses with professors
      const courses = await this.getActiveCoursesWithProfessors();
      
      for (const course of courses) {
        try {
          const summaryData = await this.generateWeeklySummary(
            course.id,
            startOfWeek,
            endOfWeek
          );
          
          if (summaryData) {
            await this.sendWeeklySummaryEmail(summaryData);
            console.log(`Sent weekly summary for course: ${summaryData.courseName}`);
          }
        } catch (error) {
          console.error(`Error generating summary for course ${course.id}:`, error);
          Sentry.captureException(error);
        }
      }
      
      console.log('Weekly summary emails completed');
    } catch (error) {
      console.error('Error in weekly summary service:', error);
      Sentry.captureException(error);
    }
  }

  private getStartOfWeek(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }

  private getEndOfWeek(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() - dayOfWeek + 7); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    return endOfWeek;
  }

  private async getActiveCoursesWithProfessors(): Promise<CourseModel[]> {
    return await CourseModel.createQueryBuilder('course')
      .leftJoinAndSelect('course.userCourses', 'userCourse')
      .leftJoinAndSelect('course.semester', 'semester')
      .where('course.enabled = :enabled', { enabled: true })
      .andWhere('userCourse.role = :role', { role: Role.PROFESSOR })
      .andWhere('course.deletedAt IS NULL')
      .getMany();
  }

  private async generateWeeklySummary(
    courseId: number,
    startDate: Date,
    endDate: Date
  ): Promise<WeeklySummaryData | null> {
    const course = await CourseModel.findOne({
      where: { id: courseId },
      relations: ['semester', 'userCourses', 'userCourses.user'],
    });

    if (!course) return null;

    const professor = course.userCourses?.find(uc => uc.role === Role.PROFESSOR)?.user;
    if (!professor?.email) return null;

    const chatbotUsage = await this.getChatbotUsageData(courseId, startDate, endDate);
    
    const asyncQuestions = await this.getAsyncQuestionsData(courseId, startDate, endDate);
    
    const recommendations = this.generateRecommendations(course, chatbotUsage, asyncQuestions);

    return {
      courseId: course.id,
      courseName: course.name,
      professorEmail: professor.email,
      semesterName: course.semester?.name,
      isActive: course.enabled,
      chatbotUsage,
      asyncQuestions,
      recommendations,
    };
  }

  private async getChatbotUsageData(
    courseId: number,
    startDate: Date,
    endDate: Date
  ) {
    // Get total interactions
    const totalInteractions = await InteractionModel.count({
      where: {
        course: { id: courseId },
        timestamp: Between(startDate, endDate),
      },
    });

    // Get unique students who used chatbot
    const uniqueStudents = await InteractionModel.createQueryBuilder('interaction')
      .select('COUNT(DISTINCT interaction.user)', 'count')
      .where('interaction.course = :courseId', { courseId })
      .andWhere('interaction.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    const dailyBreakdown = await InteractionModel.createQueryBuilder('interaction')
      .select('DATE(interaction.timestamp)', 'date')
      .addSelect('COUNT(interaction.id)', 'count')
      .where('interaction.course = :courseId', { courseId })
      .andWhere('interaction.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('DATE(interaction.timestamp)')
      .getRawMany();

    const dailyBreakdownMap: { [key: string]: number } = {};
    dailyBreakdown.forEach(day => {
      const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' });
      dailyBreakdownMap[dayName] = parseInt(day.count);
    });

    const avgScoreResult = await InteractionModel.createQueryBuilder('interaction')
      .leftJoin('interaction.questions', 'question')
      .select('AVG(question.userScore)', 'avgScore')
      .where('interaction.course = :courseId', { courseId })
      .andWhere('interaction.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .andWhere('question.userScore > 0')
      .getRawOne();

    return {
      totalInteractions,
      uniqueStudents: parseInt(uniqueStudents.count) || 0,
      dailyBreakdown: dailyBreakdownMap,
      averageScore: parseFloat(avgScoreResult.avgScore) || 0,
    };
  }

  private async getAsyncQuestionsData(
    courseId: number,
    startDate: Date,
    endDate: Date
  ) {
    // Get questions created in the past week
    const questions = await AsyncQuestionModel.find({
      where: {
        courseId,
        createdAt: Between(startDate, endDate),
        status: Not(asyncQuestionStatus.StudentDeleted),
      },
      relations: ['comments'],
      order: { createdAt: 'DESC' },
    });

    // Count by status
    const statusCounts = questions.reduce((acc, question) => {
      acc[question.status] = (acc[question.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count new comments (comments created in the past week)
    const newComments = await AsyncQuestionCommentModel.count({
      where: {
        question: { courseId },
        createdAt: Between(startDate, endDate),
      },
    });

    // Get recent questions with new comments
    const recentQuestions = questions.slice(0, 5).map(q => ({
      id: q.id,
      questionAbstract: q.questionAbstract,
      status: q.status,
      createdAt: q.createdAt,
      hasNewComments: q.comments.some(c => 
        c.createdAt >= startDate && c.createdAt <= endDate
      ),
    }));

    return {
      total: questions.length,
      aiAnswered: statusCounts[asyncQuestionStatus.AIAnswered] || 0,
      aiAnsweredResolved: statusCounts[asyncQuestionStatus.AIAnsweredResolved] || 0,
      aiAnsweredNeedsAttention: statusCounts[asyncQuestionStatus.AIAnsweredNeedsAttention] || 0,
      humanAnswered: statusCounts[asyncQuestionStatus.HumanAnswered] || 0,
      stillNeedHelp: questions.filter(q => 
        [asyncQuestionStatus.AIAnswered, asyncQuestionStatus.AIAnsweredNeedsAttention].includes(q.status)
      ).length,
      newComments,
      recentQuestions,
    };
  }

  private generateRecommendations(
    course: CourseModel,
    chatbotUsage: any,
    asyncQuestions: any
  ): string[] {
    const recommendations: string[] = [];

    // Check if course is inactive
    if (chatbotUsage.totalInteractions === 0 && asyncQuestions.total === 0) {
      recommendations.push('Consider archiving this course as there has been no activity this week.');
    }

    // Check if semester has ended
    if (course.semester && new Date() > new Date(course.semester.endDate)) {
      recommendations.push('This course\'s semester has ended. Consider archiving it.');
    }

    // Chatbot usage recommendations
    if (chatbotUsage.totalInteractions > 0) {
      if (chatbotUsage.averageScore < 3) {
        recommendations.push('Consider reviewing chatbot responses - students are giving low scores.');
      }
      if (chatbotUsage.uniqueStudents < 5) {
        recommendations.push('Encourage more students to try the chatbot feature.');
      }
    }

    // Async questions recommendations
    if (asyncQuestions.stillNeedHelp > 0) {
      recommendations.push(`${asyncQuestions.stillNeedHelp} questions still need attention.`);
    }
    if (asyncQuestions.newComments > 0) {
      recommendations.push(`${asyncQuestions.newComments} new comments were added this week.`);
    }

    return recommendations;
  }

  private async sendWeeklySummaryEmail(data: WeeklySummaryData): Promise<void> {
    const subject = `Weekly HelpMe Summary - ${data.courseName}`;
    const htmlContent = this.generateEmailHTML(data);
    
    await this.mailService.sendEmail({
      receiverOrReceivers: data.professorEmail,
      subject,
      content: htmlContent,
      type: MailServiceType.ASYNC_QUESTION_HUMAN_ANSWERED, // Using existing type for now
      track: true,
      metadata: {
        courseId: data.courseId,
        courseName: data.courseName,
        weekStart: this.getStartOfWeek().toISOString(),
        weekEnd: this.getEndOfWeek().toISOString(),
      },
    });
  }

  private generateEmailHTML(data: WeeklySummaryData): string {
    const weekStart = this.getStartOfWeek().toLocaleDateString();
    const weekEnd = this.getEndOfWeek().toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly HelpMe Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .section { margin-bottom: 30px; }
          .metric-card { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
          .metric-title { font-size: 18px; font-weight: bold; color: #495057; margin-bottom: 10px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #007bff; }
          .metric-subtitle { color: #6c757d; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Weekly HelpMe Summary</h1>
          <p><strong>Course:</strong> ${data.courseName}</p>
          <p><strong>Week:</strong> ${weekStart} - ${weekEnd}</p>
          ${data.semesterName ? `<p><strong>Semester:</strong> ${data.semesterName}</p>` : ''}
        </div>

        <div class="section">
          <h2>🤖 Chatbot Usage</h2>
          <div class="metric-card">
            <div class="metric-title">Total Interactions</div>
            <div class="metric-value">${data.chatbotUsage.totalInteractions}</div>
            <div class="metric-subtitle">Questions asked to the chatbot</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-title">Unique Students</div>
            <div class="metric-value">${data.chatbotUsage.uniqueStudents}</div>
            <div class="metric-subtitle">Students who used the chatbot</div>
          </div>
        </div>

        <div class="section">
          <h2>❓ Async Questions</h2>
          <div class="metric-card">
            <div class="metric-title">Total Questions</div>
            <div class="metric-value">${data.asyncQuestions.total}</div>
            <div class="metric-subtitle">Questions asked this week</div>
          </div>
        </div>

        ${data.recommendations.length > 0 ? `
        <div class="section">
          <h2>💡 Recommendations</h2>
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px;">
            ${data.recommendations.map(rec => `<div>💡 ${rec}</div>`).join('')}
          </div>
        </div>
        ` : ''}
      </body>
      </html>
    `;
  }
}