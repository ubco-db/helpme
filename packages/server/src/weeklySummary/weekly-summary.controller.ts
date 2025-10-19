import { Controller, Post, UseGuards, Res, HttpStatus, Get, Param, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { WeeklySummaryService } from './weekly-summary.service';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CourseModel } from '../course/course.entity';
import { UserCourseModel } from '../profile/user-course.entity';
import { Role } from '@koh/common';
import { User, UserId } from '../decorators/user.decorator';
import { UserModel } from '../profile/user.entity';

@Controller('weeklySummary')
export class WeeklySummaryController {
  constructor(private readonly weeklySummaryService: WeeklySummaryService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async sendWeeklySummaries(@Res() res: Response): Promise<Response> {
    try {
      await this.weeklySummaryService.sendWeeklySummaries();
      return res.status(HttpStatus.OK).json({ 
        message: 'Weekly summaries sent successfully' 
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
        message: 'Error sending weekly summaries',
        error: error.message 
      });
    }
  }

  @Get('test/:courseId')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async testWeeklySummary(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Res() res: Response
  ): Promise<Response> {
    try {
      const startOfWeek = this.getStartOfWeek();
      const endOfWeek = this.getEndOfWeek();
      
      const summaryData = await this.weeklySummaryService['generateWeeklySummary'](
        courseId,
        startOfWeek,
        endOfWeek
      );
      
      if (!summaryData) {
        return res.status(HttpStatus.NOT_FOUND).json({
          message: 'No course found or no professor assigned',
          courseId
        });
      }

      return res.status(HttpStatus.OK).json({
        message: 'Weekly summary data generated successfully',
        data: summaryData
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error generating weekly summary',
        error: error.message
      });
    }
  }

  private getStartOfWeek(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1); // Monday
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

  @Get('test-page')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getTestPage(@Res() res: Response): Promise<void> {
    try {
      const testPagePath = path.join(__dirname, 'test-page.html');
      const html = fs.readFileSync(testPagePath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      res.status(HttpStatus.NOT_FOUND).send('Test page not found');
    }
  }

  @Get('courses')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  async getAvailableCourses(@Res() res: Response): Promise<Response> {
    try {
      const courses = await CourseModel.createQueryBuilder('course')
        .leftJoinAndSelect('course.userCourses', 'userCourse')
        .leftJoinAndSelect('course.semester', 'semester')
        .leftJoinAndSelect('userCourse.user', 'user')
        .where('course.enabled = :enabled', { enabled: true })
        .andWhere('userCourse.role = :role', { role: Role.PROFESSOR })
        .andWhere('course.deletedAt IS NULL')
        .select([
          'course.id',
          'course.name',
          'course.enabled',
          'user.email',
          'semester.name'
        ])
        .getMany();

      return res.status(HttpStatus.OK).json({
        message: 'Available courses with professors',
        courses: courses.map(course => ({
          id: course.id,
          name: course.name,
          professorEmail: course.userCourses?.[0]?.user?.email,
          semesterName: course.semester?.name,
          enabled: course.enabled
        }))
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error fetching courses',
        error: error.message
      });
    }
  }
}
