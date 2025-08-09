 
import { Test, TestingModule } from '@nestjs/testing';
import { BackupService, baseBackupCommand } from './backup.service';
import * as fs from 'fs';
import { Stats } from 'fs';
import { exec } from 'child_process';

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
          `${baseBackupCommand} ../../backups/daily/backup-${todayFormatted}.sql.gz`,
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
          `${baseBackupCommand} ../../backups/semi-hourly/backup-${todayFormatted}-${hour}.sql.gz`,
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
          `${baseBackupCommand} ../../backups/monthly/backup-${todayFormatted}.sql.gz`,
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

  describe('handleDailyUploadsBackup', () => {
    const backupDir = '../../backups/uploads-daily';
    const uploadsDir = './uploads';
    const todayFormatted = new Date().toISOString().split('T')[0];
    const backupFile = `uploads_backup-${todayFormatted}.tar.gz`;

    beforeEach(() => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(true);

      // Mock exec to simulate tar command execution
      execMock.mockImplementation((command, callback) => {
        callback(null, { stdout: 'success' }); // Simulate successful tar execution
      });

      // mocks for readdirSync and statSync from fs
      jest.spyOn(fs, 'readdirSync').mockReturnValue([
        {
          name: 'uploads_backup-2023-01-01.tar.gz',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        },
        {
          name: 'uploads_backup-2023-01-02.tar.gz',
          isFile: () => true,
          isDirectory: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        },
      ] as fs.Dirent<any>[]);

      jest.spyOn(fs, 'statSync').mockImplementation((filePath: string) => {
        const mockStats = {
          isFile: jest.fn(() => true),
          isDirectory: jest.fn(() => false),
          isBlockDevice: jest.fn(() => false),
          isCharacterDevice: jest.fn(() => false),
          isSymbolicLink: jest.fn(() => false),
          isFIFO: jest.fn(() => false),
          isSocket: jest.fn(() => false),
          mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Mocked modification time
          atime: new Date(),
          ctime: new Date(),
          birthtime: new Date(),
        } as Partial<Stats>;

        return mockStats as Stats;
      });

      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create an uploads backup when there is sufficient disk space', async () => {
      await service.handleDailyUploadsBackup();

      expect(execMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `tar -czf ${backupDir}/${backupFile} -C ${uploadsDir} .`,
        ),
        expect.any(Function),
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Uploads backup saved: ${backupFile}`),
      );
    });

    it('should log an error if there is insufficient disk space', async () => {
      jest.spyOn(service, 'checkDiskSpace').mockResolvedValue(false);

      await service.handleDailyUploadsBackup();

      expect(execMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient disk space for uploads backup.'),
      );
    });

    it('should handle errors during the tar command execution', async () => {
      execMock.mockImplementationOnce((command, callback) => {
        callback(new Error('Tar command failed'), {
          stdout: '',
          stderr: 'Mock Error Message from stderr',
        });
      });

      await service.handleDailyUploadsBackup();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Uploads backup failed:'),
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

  describe('deleteOldBackups', () => {
    it('ignores .md files', () => {
      (fs.readdir as unknown as jest.Mock).mockImplementation((dir, cb) =>
        cb(null, ['old-backup.sql.gz', 'readme.md']),
      );
      service['deleteOldBackups']('/some/dir', 1);
      expect(fs.unlink).toHaveBeenCalledTimes(1); // readme.md not unlinked
    });

    it('deletes older backups', () => {
      (fs.readdir as unknown as jest.Mock).mockImplementation((dir, cb) =>
        cb(null, ['old-backup.sql.gz']),
      );
      (fs.stat as unknown as jest.Mock).mockImplementation((filePath, cb) => {
        cb(null, {
          mtime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // old
        });
      });
      service['deleteOldBackups']('/some/dir', 1);
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('old-backup.sql.gz'),
        expect.any(Function),
      );
    });

    it('keeps newer backups', () => {
      (fs.readdir as unknown as jest.Mock).mockImplementation((dir, cb) =>
        cb(null, ['new-backup.sql.gz']),
      );
      (fs.stat as unknown as jest.Mock).mockImplementation((filePath, cb) => {
        cb(null, {
          mtime: new Date(), // new
        });
      });
      service['deleteOldBackups']('/some/dir', 1);
      expect(fs.unlink).not.toHaveBeenCalled();
    });
  });
});
