import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { EmailVerifiedGuard } from '../guards/email-verified.guard';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';

@Controller('admin')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, AdminRoleGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Gets all cron jobs for the system.
   */
  @Get('cronjobs')
  @UseGuards(JwtAuthGuard, AdminRoleGuard, EmailVerifiedGuard)
  async getAllCronJobs(): Promise<any[] | CronJob[]> {
    const jobs = this.schedulerRegistry.getCronJobs();
    const jobsArray = Array.from(jobs.entries()).map(([key, job]) => {
      const nextDates = job.running ? job.nextDates(10) : [];
      return {
        id: key,
        cronTime: job.cronTime.source,
        running: job.running,
        nextDates: nextDates,
        lastExecution: job.lastExecution,
        runOnce: job.runOnce,
      };
    });
    return jobsArray;
  }
}
