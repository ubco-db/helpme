import { Logger } from '@nestjs/common';
import { exec, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { PassThrough, Readable, Writable } from 'stream';
import { createGunzip, gzipSync } from 'zlib';
import type * as Zlib from 'zlib';
import { BackupService, basePsqlCommand } from './backup.service';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

jest.mock('zlib', () => {
  const actual = jest.requireActual<typeof Zlib>('zlib');
  return {
    ...actual,
    createGunzip: jest.fn(() => {
      const gunzip = actual.createGunzip();
      // Observe failures without allowing an unhandled event to crash Jest when
      // exercising the old, non-pipeline implementation.
      gunzip.on('error', () => {});
      return gunzip;
    }),
  };
});

class RestoreChild extends EventEmitter {
  readonly chunks: Buffer[] = [];
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin: Writable;
  readonly kill = jest.fn(() => {
    setImmediate(() => this.close(null));
    return true;
  });
  private closed = false;

  constructor(writeError?: Error, autoClose = true) {
    super();
    this.stdin = new Writable({
      write: (chunk, _encoding, callback) => {
        if (writeError) {
          callback(writeError);
        } else {
          this.chunks.push(Buffer.from(chunk));
          callback();
        }
      },
    });
    this.stdin.on('error', () => {});
    if (autoClose) {
      this.stdin.once('finish', () => setImmediate(() => this.close(0)));
    }
  }

  close(code: number | null) {
    if (!this.closed) {
      this.closed = true;
      this.stdout.end();
      this.stderr.end();
      this.emit('close', code);
    }
  }
}

const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));
const streamError = (stream: NodeJS.EventEmitter) =>
  new Promise<Error>((resolve) => stream.once('error', resolve));

describe('BackupService restoreDatabaseBackup', () => {
  const backupPath = '/mock-backups/restore.sql.gz';
  const sql = 'CREATE DATABASE restored;\n\\connect restored\nSELECT 42;\n';
  const preflightCommand = `${basePsqlCommand} -d postgres -c "SELECT 1;"`;
  const execMock = jest.mocked(exec);
  const spawnMock = jest.mocked(spawn);
  let service: BackupService;
  let child: RestoreChild;
  let source: Readable;
  let flushRedis: jest.SpyInstance;
  let spawned: Promise<void>;

  function startRestore(databases: string[] = ['dev', 'chatbot']) {
    const promise = service.restoreDatabaseBackup(backupPath, databases);
    // Attach a rejection handler immediately, including for failures occurring
    // before the test has finished arranging child-process events.
    const settled = jest.fn();
    void promise.then(settled, settled);
    return { promise, settled };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger, 'log').mockImplementation(() => {});
    jest.spyOn(Logger, 'error').mockImplementation(() => {});
    service = new BackupService();
    flushRedis = jest.spyOn(service, 'flushRedis').mockResolvedValue(undefined);
    jest.mocked(fs.existsSync).mockReturnValue(true);
    source = Readable.from([gzipSync(sql)]);
    source.on('error', () => {});
    jest
      .mocked(fs.createReadStream)
      .mockImplementation(() => source as fs.ReadStream);
    execMock.mockImplementation((_command, _options, callback: any) => {
      callback(null, '', '');
      return undefined;
    });
    child = new RestoreChild();
    spawned = new Promise<void>((resolve) => {
      spawnMock.mockImplementation(() => {
        resolve();
        return child as unknown as ReturnType<typeof spawn>;
      });
    });
  });

  afterEach(() => {
    child.close(null);
    source.destroy();
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    for (const result of jest.mocked(createGunzip).mock.results) {
      if (result.type === 'return') {
        result.value.destroy();
      }
    }
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('preflights before dropping databases and streams real gunzip output into psql on postgres', async () => {
    const resume = jest.spyOn(child.stdout, 'resume');
    const { promise } = startRestore();

    await expect(promise).resolves.toBe(
      'Backup loaded successfully. You may need to restart the server.',
    );

    expect(execMock).toHaveBeenCalledTimes(3);
    expect(execMock).toHaveBeenNthCalledWith(
      1,
      preflightCommand,
      { timeout: 60000 },
      expect.any(Function),
    );
    for (const [index, database] of ['dev', 'chatbot'].entries()) {
      expect(execMock).toHaveBeenNthCalledWith(
        index + 2,
        `${basePsqlCommand} -d postgres -c "DROP DATABASE IF EXISTS ${database};"`,
        { timeout: 60000 },
        expect.any(Function),
      );
    }
    expect(execMock.mock.invocationCallOrder[2]).toBeLessThan(
      spawnMock.mock.invocationCallOrder[0],
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalledWith(`${basePsqlCommand} -d postgres`, {
      shell: true,
    });
    expect(fs.createReadStream).toHaveBeenCalledWith(backupPath);
    expect(Buffer.concat(child.chunks).toString()).toBe(sql);
    expect(resume).toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
    expect(flushRedis).toHaveBeenCalledTimes(1);
  });

  it('does not drop databases, spawn psql, or read the backup if preflight fails', async () => {
    execMock.mockImplementation((command, _options, callback: any) => {
      callback(
        command === preflightCommand ? new Error('psql unavailable') : null,
        '',
        '',
      );
      return undefined;
    });

    const { promise } = startRestore();

    await expect(promise).rejects.toThrow('psql unavailable');
    expect(execMock).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledWith(
      preflightCommand,
      { timeout: 60000 },
      expect.any(Function),
    );
    expect(spawnMock).not.toHaveBeenCalled();
    expect(fs.createReadStream).not.toHaveBeenCalled();
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('waits for close after EPIPE and includes stderr arriving after the stream failure', async () => {
    child = new RestoreChild(
      Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
      false,
    );
    const failedWrite = streamError(child.stdin);
    const { promise, settled } = startRestore();
    await spawned;
    await expect(failedWrite).resolves.toMatchObject({ code: 'EPIPE' });
    await nextTurn();

    expect(settled).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
    expect(flushRedis).not.toHaveBeenCalled();
    child.stderr.write('psql: FATAL: ');
    await nextTurn();
    child.stderr.write('database "postgres" does not exist\n');
    child.close(2);

    await expect(promise).rejects.toThrow(
      'psql: FATAL: database "postgres" does not exist',
    );
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('rejects EPIPE even if psql subsequently closes with exit code zero', async () => {
    child = new RestoreChild(
      Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
      false,
    );
    const failedWrite = streamError(child.stdin);
    const { promise } = startRestore();
    await failedWrite;
    await nextTurn();
    child.close(0);

    await expect(promise).rejects.toThrow(/EPIPE/);
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('rejects corrupt gzip data and kills psql rather than reporting success', async () => {
    source = Readable.from([Buffer.from('not a gzip archive')]);
    child = new RestoreChild(undefined, false);
    const { promise } = startRestore();
    await spawned;
    const gunzip = jest.mocked(createGunzip).mock.results[0].value;
    await streamError(gunzip);
    await nextTurn();
    // A zero exit status must not hide the decompression failure.
    child.close(0);

    await expect(promise).rejects.toThrow(/incorrect header check/i);
    expect(child.kill).toHaveBeenCalled();
    expect(source.destroyed).toBe(true);
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('rejects source read errors and kills psql', async () => {
    source = new Readable({
      read() {
        this.destroy(new Error('backup read failed'));
      },
    });
    const failedRead = streamError(source);
    child = new RestoreChild(undefined, false);
    const { promise } = startRestore();
    await failedRead;
    await nextTurn();
    child.close(0);

    await expect(promise).rejects.toThrow('backup read failed');
    expect(child.kill).toHaveBeenCalled();
    expect(source.destroyed).toBe(true);
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('rejects child spawn errors without flushing redis', async () => {
    child = new RestoreChild(undefined, false);
    const { promise } = startRestore();
    await spawned;
    child.emit('error', new Error('spawn ENOENT'));
    child.close(null);

    await expect(promise).rejects.toThrow(/spawn ENOENT/);
    expect(flushRedis).not.toHaveBeenCalled();
  });

  it('destroys restore streams and kills psql when the restore times out', async () => {
    jest.useFakeTimers();
    source = new Readable({ read() {} });
    child = new RestoreChild(undefined, false);
    const { promise } = startRestore();
    await spawned;
    const gunzip = jest.mocked(createGunzip).mock.results[0].value;

    await jest.advanceTimersByTimeAsync(10 * 60 * 1000);

    await expect(promise).rejects.toThrow(/timed out/i);
    expect(source.destroyed).toBe(true);
    expect(gunzip.destroyed).toBe(true);
    expect(child.stdin.destroyed).toBe(true);
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(flushRedis).not.toHaveBeenCalled();
  });
});
