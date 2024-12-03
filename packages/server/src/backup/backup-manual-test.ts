import { BackupService } from './backup.service';

/*
 * Manual tests for the backup service that bypass the cron jobs.
 *
 * Command: yarn tsx backup-manual-test.ts
 *
 * Note: when using tsx, the relative paths are resolved from the root of this node project (packages/server).
 */

async function runManualTests() {
  const backupService = new BackupService();

  backupService.checkDiskSpace = async () => true; // mock for non-linux environments

  console.log('Running manual backup tests...');

  try {
    console.log('Testing daily backup...');
    await backupService.handleDailyBackup();

    console.log('Testing semi-hourly backup...');
    await backupService.handleSemiHourlyBackup();

    console.log('Testing monthly backup...');
    await backupService.handleMonthlyBackup();

    console.log('Testing uploads backup...');
    await backupService.handleDailyUploadsBackup();

    console.log('All manual backup tests completed.');
  } catch (error) {
    console.error('Error during manual tests:', error);
  }
}

runManualTests();
