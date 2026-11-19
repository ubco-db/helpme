export declare const MAX_WORKERS_CAP: number;
export declare function getAvailableParallelism(): number;
export declare function getMaxWorkers(): number;
export declare function getWorkerId(): number;
export declare function getTestDatabaseName(
  baseName: string,
  workerId?: number,
): string;
export declare function getTestRedisDb(workerId?: number): number;
export declare function getTestUploadLocation(workerId?: number): string;
export declare function getTestRedisChannelPrefix(workerId?: number): string;
export declare function getTestBullPrefix(workerId?: number): string;
