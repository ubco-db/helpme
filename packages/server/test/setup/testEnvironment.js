/**
 * Shared test-environment configuration used by both Jest itself (the config
 * files and the global setup script) and the TypeScript test helpers.
 *
 * This file is intentionally plain CommonJS so it can be required from
 * `jest.config.js`, `jest-integration.config.js`, and `global-setup.js` without
 * a TypeScript transform. `testEnvironment.d.ts` provides the types for the
 * TypeScript imports.
 */
const os = require('os');
const path = require('path');

// Redis ships with 16 logical databases (0-15). Reserving 0 for anything that
// still uses the default keeps us safe; capping at 12 also avoids spawning an
// unreasonable number of Nest apps on very large machines.
const MAX_WORKERS_CAP = 12;
const FIRST_WORKER_REDIS_DB = 1;

function getAvailableParallelism() {
  if (typeof os.availableParallelism === 'function') {
    return os.availableParallelism();
  }
  return os.cpus().length;
}

/**
 * Number of Jest workers to use. Matches Jest's default (cores - 1) but caps
 * the value so every worker gets a unique PostgreSQL/Redis resource.
 */
function getMaxWorkers() {
  const override = Number.parseInt(process.env.TEST_MAX_WORKERS || '', 10);
  if (Number.isFinite(override) && override > 0) {
    return Math.min(override, MAX_WORKERS_CAP);
  }
  return Math.max(1, Math.min(getAvailableParallelism() - 1, MAX_WORKERS_CAP));
}

/** 1-based worker id assigned by Jest. */
function getWorkerId() {
  const workerId = Number.parseInt(process.env.JEST_WORKER_ID || '1', 10);
  return Number.isFinite(workerId) && workerId > 0 ? workerId : 1;
}

/**
 * Every worker gets its own copy of each database, e.g. `test_3`,
 * `chatbot_test_3`, `lti_test_3`.
 */
function getTestDatabaseName(baseName, workerId = getWorkerId()) {
  return `${baseName}_${workerId}`;
}

/** Redis logical database index for a worker. */
function getTestRedisDb(workerId = getWorkerId()) {
  if (workerId > MAX_WORKERS_CAP) {
    throw new Error(
      `Jest worker ${workerId} exceeds the supported maximum of ${MAX_WORKERS_CAP} workers. ` +
        `Lower Jest's maxWorkers (for example with TEST_MAX_WORKERS).`,
    );
  }
  return FIRST_WORKER_REDIS_DB + (workerId - 1);
}

/**
 * Uploads are written to a per-worker directory so parallel suites cannot see
 * or delete each other's files.
 */
function getTestUploadLocation(workerId = getWorkerId()) {
  const baseUploadLocation = process.env.UPLOAD_LOCATION || 'uploads';
  const suffix = `test-${workerId}`;
  if (path.basename(baseUploadLocation) === suffix) {
    return baseUploadLocation;
  }
  return path.join(baseUploadLocation, suffix);
}

/** Prefix used for Redis pub/sub channels (which ignore the Redis DB index). */
function getTestRedisChannelPrefix(workerId = getWorkerId()) {
  return `test-${workerId}:`;
}

/** BullMQ key prefix for a worker. */
function getTestBullPrefix(workerId = getWorkerId()) {
  return `test-${workerId}`;
}

module.exports = {
  MAX_WORKERS_CAP,
  getAvailableParallelism,
  getMaxWorkers,
  getWorkerId,
  getTestDatabaseName,
  getTestRedisDb,
  getTestUploadLocation,
  getTestRedisChannelPrefix,
  getTestBullPrefix,
};
