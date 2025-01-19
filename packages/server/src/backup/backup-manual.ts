import { BackupService } from './backup.service';

/*
 * Manual backups for the backup service that bypass the cron jobs.
 *
 * Command: yarn tsx backup-manual.ts
 *
 * Note: when using tsx, the relative paths are resolved from the root of this node project (packages/server).
 */

async function runManualBackups() {
  const backupService = new BackupService();

  backupService.checkDiskSpace = async () => true; // Bypass check for non-linux environments (non-prod)

  console.log('Running manual backups...');

  try {
    console.log('Running daily backup...');
    await backupService.handleDailyBackup();

    console.log('Running semi-hourly backup...');
    await backupService.handleSemiHourlyBackup();

    console.log('Running monthly backup...');
    await backupService.handleMonthlyBackup();

    console.log('Running uploads backup...');
    await backupService.handleDailyUploadsBackup();

    console.log('All manual backups completed.');
  } catch (error) {
    console.error('Error during manual backup:', error);
  }
}

runManualBackups();
