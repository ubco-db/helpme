import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as Sentry from '@sentry/nestjs';
import { createGzip, createGunzip } from 'zlib';

/*
 * NOTE: all paths here are relative to package/server
 */

const execPromise = promisify(exec);

/**
 * The base pg_dumpall command (without the `| gzip >` suffix).
 * Used by the generalized export method and can be overridden via env var.
 */
export const basePgDumpCommand =
  process.env.BASE_PG_DUMP_COMMAND ||
  'docker exec -u postgres helpme-postgresql-1 pg_dumpall -U postgres';

/**
 * The base psql command prefix for restore/drop operations.
 * Can be overridden via env var.
 */
export const basePsqlCommand =
  process.env.BASE_PSQL_COMMAND ||
  'docker exec -i helpme-postgresql-1 psql -U postgres';

/**
 * The command to flush the redis cache.
 * Can be overridden via env var.
 */
export const redisFlushCommand =
  process.env.REDIS_FLUSH_COMMAND ||
  'docker exec helpme-redis-1 redis-cli flushall';

/**
 * Legacy: the full backup command with `| gzip >` suffix, used by cron backups.
 * Kept for backwards compatibility with the existing cron methods.
 */
export const baseBackupCommand =
  process.env.BASE_BACKUP_COMMAND ||
  'docker exec -u postgres helpme-postgresql-1 pg_dumpall -U postgres | gzip >';

/** 10 minutes in ms — backup/restore can be slow on some machines */
const LONG_TIMEOUT_MS = 10 * 60 * 1000;

@Injectable()
export class BackupService {
  private readonly MINIMUM_FREE_SPACE_MB = 1000; // Minimum space (in MB) required for backup

  // ──────────────────────────────────────────────────────
  //  Generalized backup/restore methods
  // ──────────────────────────────────────────────────────

  /**
   * Creates a gzipped database backup at the given file path using pg_dumpall.
   * The directory will be created if it doesn't exist.
   * Uses Node streams to avoid platform-specific shell piping requirements (like gzip).
   * @param outputPath Absolute path where the .sql.gz file should be written.
   * @returns A message describing the result (including file size).
   */
  async exportDatabaseBackup(outputPath: string): Promise<string> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    Logger.log(
      `Exporting database backup: ${basePgDumpCommand}`,
      'BackupService',
    );

    return new Promise((resolve, reject) => {
      const child = spawn(basePgDumpCommand, { shell: true });
      const writeStream = fs.createWriteStream(outputPath);
      const gzip = createGzip();

      child.stdout.pipe(gzip).pipe(writeStream);

      child.on('error', (err) =>
        reject(new Error(`Spawn failed: ${err.message}`)),
      );

      let errorOutput = '';
      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const timeoutId = setTimeout(() => {
        child.kill();
        reject(new Error('Backup export timed out after 10 minutes'));
      }, LONG_TIMEOUT_MS);

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code !== 0) {
          reject(new Error(`Command exited with code ${code}: ${errorOutput}`));
          return;
        }

        try {
          const stats = fs.statSync(outputPath);
          if (stats.size === 0) {
            reject(new Error('Backup file is empty'));
            return;
          }
          const sizeKB = (stats.size / 1024).toFixed(1);
          Logger.log(
            `Database backup exported successfully (${sizeKB} KB)`,
            'BackupService',
          );
          resolve(
            `Backup exported successfully to ${path.basename(outputPath)} (${sizeKB} KB)`,
          );
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  /**
   * Restores a gzipped database backup from the given file path.
   * Drops the specified databases first, then pipes the backup into psql,
   * and finally flushes redis.
   * Uses Node streams to avoid platform-specific shell dependencies (like gunzip).
   * @param backupPath Absolute path to the .sql.gz backup file.
   * @param databasesToDrop Array of database names to drop before restoring (e.g. ['dev', 'chatbot']).
   * @returns A message describing the result.
   */
  async restoreDatabaseBackup(
    backupPath: string,
    databasesToDrop: string[],
  ): Promise<string> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(
        `No backup file found at ${path.basename(backupPath)}. Export a backup first.`,
      );
    }

    Logger.log(`Restoring database backup from ${backupPath}`, 'BackupService');

    try {
      // Drop the specified databases so the restore can recreate them
      for (const db of databasesToDrop) {
        const dropCommand = `${basePsqlCommand} -d postgres -c "DROP DATABASE IF EXISTS ${db};"`;
        Logger.log(
          `Dropping database "${db}": ${dropCommand}`,
          'BackupService',
        );
        await execPromise(dropCommand, { timeout: 60000 });
      }

      Logger.log(
        `Restoring backup via Node streams: ${basePsqlCommand}`,
        'BackupService',
      );
      await new Promise<void>((resolve, reject) => {
        const child = spawn(basePsqlCommand, { shell: true });
        const readStream = fs.createReadStream(backupPath);
        const gunzip = createGunzip();

        readStream.pipe(gunzip).pipe(child.stdin);

        child.on('error', (err) =>
          reject(new Error(`Spawn failed: ${err.message}`)),
        );

        let errorOutput = '';
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        const timeoutId = setTimeout(() => {
          child.kill();
          reject(new Error('Backup restore timed out after 10 minutes'));
        }, LONG_TIMEOUT_MS);

        child.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code !== 0) {
            reject(
              new Error(`Command exited with code ${code}: ${errorOutput}`),
            );
          } else {
            resolve();
          }
        });
      });

      // Flush redis cache to prevent stale data
      await this.flushRedis();

      Logger.log('Database backup restored successfully', 'BackupService');
      return 'Backup loaded successfully. You may need to restart the server.';
    } catch (error) {
      Logger.error(
        `Database backup restore failed: ${error.message}`,
        'BackupService',
      );
      throw new Error(`Backup restore failed: ${error.message}`);
    }
  }

  /**
   * Flushes the redis cache. Logs a warning if it fails (e.g. container not running).
   */
  async flushRedis(): Promise<void> {
    try {
      await execPromise(redisFlushCommand, { timeout: 10000 });
      Logger.log('Redis cache flushed', 'BackupService');
    } catch {
      Logger.warn(
        'Could not flush redis cache - you may need to do this manually',
        'BackupService',
      );
    }
  }

  // ──────────────────────────────────────────────────────
  //  Cron-based production backup methods (existing)
  // ──────────────────────────────────────────────────────

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
