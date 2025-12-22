import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as Sentry from '@sentry/nestjs';

/*
 * NOTE: all paths here are relative to package/server
 */

const execPromise = promisify(exec);

export const baseBackupCommand =
  process.env.BASE_BACKUP_COMMAND ||
  'docker exec -u postgres helpme-postgresql-1 pg_dumpall -U postgres | gzip >';

@Injectable()
export class BackupService {
  private readonly MINIMUM_FREE_SPACE_MB = 1000; // Minimum space (in MB) required for backup

  // Daily Backup Task - Keeps rolling backups for 14 days (TODO: change back to 30 when we get a proper place for backups)
  // @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBackup() {
    const date = new Date().toISOString().split('T')[0];
    const backupFile = `backup-${date}.sql.gz`;
    const backupDir = '../../backups/daily';

    const hasSpace = await this.checkDiskSpace(backupDir);

    if (hasSpace) {
      exec(
        `${baseBackupCommand} ${backupDir}/${backupFile}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Backup failed: ${stderr}`);
            Sentry.captureMessage(`Backup failed: ${stderr}`);
          } else {
            console.log(`Daily backup saved: ${backupFile}`);
            this.deleteOldBackups(backupDir, 14);
          }
        },
      );
    } else {
      console.error('Insufficient disk space for backup.');
      Sentry.captureMessage('Insufficient disk space for backup.');
    }
  }

  // Semi-Hourly backup task - Backup every 3 hours and keep for 5 days, between 7am to 10pm (the daily backup is the 12am one)
  // @Cron('0 7-22/3 * * *')
  async handleSemiHourlyBackup() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = String(now.getHours()).padStart(2, '0');
    const backupFile = `backup-${date}-${hour}.sql.gz`;
    const backupDir = '../../backups/semi-hourly';

    const hasSpace = await this.checkDiskSpace(backupDir);

    if (hasSpace) {
      exec(
        `${baseBackupCommand} ${backupDir}/${backupFile}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Semi-hourly backup failed: ${stderr}`);
            Sentry.captureMessage(`Semi-hourly backup failed: ${stderr}`);
          } else {
            console.log(`Semi-hourly backup saved: ${backupFile}`);
            this.deleteOldBackups(backupDir, 5);
          }
        },
      );
    } else {
      console.error('Insufficient disk space for backup.');
      Sentry.captureMessage('Insufficient disk space for backup.');
    }
  }

  // Monthly Backup Task - Keeps all backups
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyBackup() {
    const date = new Date().toISOString().split('T')[0];
    const backupFile = `backup-${date}.sql.gz`;
    const backupDir = '../../backups/monthly';

    const hasSpace = await this.checkDiskSpace(backupDir);

    if (hasSpace) {
      exec(
        `${baseBackupCommand} ${backupDir}/${backupFile}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Monthly backup failed: ${stderr}`);
            Sentry.captureMessage(`Monthly backup failed: ${stderr}`);
          } else {
            console.log(`Monthly backup saved: ${backupFile}`);
          }
        },
      );
    } else {
      console.error('Insufficient disk space for backup.');
      Sentry.captureMessage('Insufficient disk space for backup.');
    }
  }

  // 4-day Uploads Backup Task - Keeps rolling backups for 12 days (3 backups)
  @Cron('0 0 */4 * *')
  async handleDailyUploadsBackup() {
    try {
      const date = new Date().toISOString().split('T')[0];
      const uploadsDir = './uploads';
      const backupFile = `uploads_backup-${date}.tar.gz`;
      const backupDir = '../../backups/uploads-daily';

      const hasSpace = await this.checkDiskSpace(backupDir);
      if (!hasSpace) {
        console.error('Insufficient disk space for uploads backup.');
        Sentry.captureMessage('Insufficient disk space for uploads backup.');
        return;
      }

      // Use `tar` to compress the uploads directory
      const compressCommand = `tar -czf ${backupDir}/${backupFile} -C ${uploadsDir} .`;

      exec(compressCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Uploads backup failed: ${stderr}`);
          Sentry.captureMessage(`Uploads backup failed: ${stderr}`);
        } else {
          console.log(`Uploads backup saved: ${backupFile}`);
          // Retain only the last 3 backups (the last 12 days)
          this.deleteOldBackups(backupDir, 12);
        }
      });
    } catch (error) {
      console.error('Error backing up uploads:', error);
      Sentry.captureMessage('Error backing up uploads:', error);
    }
  }

  // Delete backups older than N days
  private deleteOldBackups(directory: string, days: number) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    fs.readdir(directory, (err, files) => {
      if (err) throw err;
      files.forEach((file) => {
        // Skip .md files
        if (file.endsWith('.md')) {
          return;
        }
        const filePath = path.join(directory, file);
        fs.stat(filePath, (err, stats) => {
          if (err) throw err;
          if (stats.mtime.getTime() < cutoff) {
            fs.unlink(filePath, (err) => {
              if (err) throw err;
              console.log(`Deleted old backup: ${file}`);
            });
          }
        });
      });
    });
  }

  // Check if there is sufficient free space before creating a backup
  async checkDiskSpace(directory: string): Promise<boolean> {
    try {
      const { stdout } = await execPromise(
        `df -m ${directory} | tail -1 | awk '{print $4}'`,
      );
      const freeSpaceMb = parseInt(stdout.trim(), 10);

      console.log(`Free space in ${directory}: ${freeSpaceMb} MB`);
      return freeSpaceMb > this.MINIMUM_FREE_SPACE_MB;
    } catch (error) {
      console.error('Error checking disk space:', error);
      Sentry.captureMessage('Error checking disk space:', error);
      return false;
    }
  }
}
