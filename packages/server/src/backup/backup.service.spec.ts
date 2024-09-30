/* eslint-disable @typescript-eslint/no-empty-function */
import { Test, TestingModule } from '@nestjs/testing';
import { BackupService, baseBackupCommand } from './backup.service';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

jest.mock('fs');
jest.mock('child_process', () => ({
  exec: jest.fn(), // Mock exec from child_process
}));

describe('BackupService', () => {
  let service: BackupService;
  let execMock: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  const now = new Date();
  const todayFormatted = now.toISOString().split('T')[0];
  const hour = String(now.getHours()).padStart(2, '0');
  const backupFile = `backup-${todayFormatted}.sql.gz`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BackupService],
    }).compile();

    service = module.get<BackupService>(BackupService);

    // Mock exec function and its promisified version
    execMock = exec as unknown as jest.Mock;

    // Mock the fs methods
    const mockFiles = ['backup-old.sql.gz', 'backup-new.sql.gz'];

    // Mocking readdir
    (fs.readdir as unknown as jest.Mock).mockImplementation((dir, cb) =>
      cb(null, mockFiles),
    );

    // Mocking stat
    (fs.stat as unknown as jest.Mock).mockImplementation((filePath, cb) =>
      cb(null, {
        mtime: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // Older than 30 days
      }),
    );

    // Mocking unlink
    (fs.unlink as unknown as jest.Mock).mockImplementation((filePath, cb) =>
      cb(null),
    );

    // Spy on console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('handleDailyBackup', () => {
    it('should create a daily backup when there is sufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' }); // Simulate successful pg_dump
      });

      await service.handleDailyBackup();

      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `${baseBackupCommand} backups/daily/backup-${todayFormatted}.sql.gz`,
        ),
        expect.any(Function), // Mock function
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Daily backup saved: ${backupFile}`),
      );
    });

    it('should not create a backup if there is insufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(false);

      await service.handleDailyBackup();

      expect(execMock).not.toHaveBeenCalled(); // Backup shouldn't run
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient disk space for backup.'),
      );
    });

    it('should delete old backups older than 30 days', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' });
      });

      await service.handleDailyBackup();

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('backup-old.sql.gz'),
        expect.any(Function),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleted old backup: backup-old.sql.gz'),
      );
    });
  });

  describe('handleSemiHourlyBackup', () => {
    it('should create a semi-hourly backup when there is sufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' }); // Simulate successful pg_dump
      });

      await service.handleSemiHourlyBackup();

      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `${baseBackupCommand} backups/semi-hourly/backup-${todayFormatted}-${hour}.sql.gz`,
        ),
        expect.any(Function), // Mock function
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Semi-hourly backup saved: backup-${todayFormatted}-${hour}.sql.gz`,
        ),
      );
    });

    it('should not create a backup if there is insufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(false);

      await service.handleSemiHourlyBackup();

      expect(execMock).not.toHaveBeenCalled(); // Backup shouldn't run
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient disk space for backup.'),
      );
    });

    it('should delete old backups older than 5 days', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' });
      });

      await service.handleSemiHourlyBackup();

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('backup-old.sql.gz'),
        expect.any(Function),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleted old backup: backup-old.sql.gz'),
      );
    });
  });

  describe('handleMonthlyBackup', () => {
    it('should create a monthly backup when there is sufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' }); // Simulate successful pg_dump
      });

      await service.handleMonthlyBackup();

      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `${baseBackupCommand} backups/monthly/backup-${todayFormatted}.sql.gz`,
        ),
        expect.any(Function), // Mock function
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Monthly backup saved: backup-${todayFormatted}.sql.gz`,
        ),
      );
    });

    it('should not create a backup if there is insufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(false);

      await service.handleMonthlyBackup();

      expect(execMock).not.toHaveBeenCalled(); // Backup shouldn't run
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient disk space for backup.'),
      );
    });
  });

  describe('checkDiskSpace', () => {
    it('should return true if there is enough disk space', async () => {
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: '2000' }); // Simulate 2000 MB free space
      });

      const hasSpace = await service.checkDiskSpace('backups/daily');
      expect(hasSpace).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Free space in backups/daily: 2000 MB'),
      );
    });

    it('should return false if there is not enough disk space', async () => {
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: '500' }); // Simulate 500 MB free space
      });

      const hasSpace = await service.checkDiskSpace('backups/daily');
      expect(hasSpace).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Free space in backups/daily: 500 MB'),
      );
    });
  });
});