/**
 * Jest global setup.
 *
 * Creates one isolated PostgreSQL database set per Jest worker:
 *   - test_<workerId>
 *   - chatbot_test_<workerId>
 *   - lti_test_<workerId>
 *
 * Recreating the databases on every run keeps parallel workers completely
 * isolated from each other and avoids schema drift between branches. The cost
 * is a few seconds once per Jest invocation.
 *
 * This file is plain CommonJS because Jest loads global setup without applying
 * the project's TypeScript transform.
 */
// Set the timezone before Jest spawns worker processes; workers inherit this.
// Jest's setupFiles also sets it, but that runs after Node has already cached
// the local timezone, which matters for PostgreSQL `date` columns.
process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const { getMaxWorkers, getTestDatabaseName } = require('./testEnvironment');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const DATABASES = ['test', 'chatbot_test', 'lti_test'];
// The chatbot database uses pgvector; the rest only need UUID generation.
const EXTENSIONS_BY_DATABASE = {
  test: ['uuid-ossp'],
  chatbot_test: ['uuid-ossp', 'vector'],
  lti_test: ['uuid-ossp'],
};

function loadEnvironment() {
  const envPath = path.join(SERVER_ROOT, '.env');
  const envDevelopmentPath = path.join(SERVER_ROOT, '.env.development');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    dotenv.config({ path: envDevelopmentPath });
  }
  dotenv.config({ path: path.join(SERVER_ROOT, 'postgres.env') });
}

function getConnectionCandidates(overrides = {}) {
  const candidates = [];
  if (process.env.POSTGRES_USER) {
    candidates.push({
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });
  }
  if (
    process.env.POSTGRES_NONROOT_USER &&
    process.env.POSTGRES_NONROOT_USER !== process.env.POSTGRES_USER
  ) {
    candidates.push({
      user: process.env.POSTGRES_NONROOT_USER,
      password: process.env.POSTGRES_NONROOT_PASSWORD,
    });
  }
  return candidates.map((candidate) => ({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: 'postgres',
    connectionTimeoutMillis: 5000,
    ...candidate,
    ...overrides,
  }));
}

const TRANSIENT_CONNECTION_ERRORS = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  '57P03', // the database system is starting up
  '53300', // too many clients already
]);

async function connect(config, attempts = 10) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const client = new Client(config);
    try {
      await client.connect();
      return client;
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch {
        // Ignore cleanup errors on a failed connection.
      }
      if (
        !TRANSIENT_CONNECTION_ERRORS.has(err.code) ||
        attempt === attempts - 1
      ) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

/**
 * In CI the service container is configured with POSTGRES_USER=postgres, but
 * the copied postgres.env.example also says POSTGRES_USER=postgres even though
 * the actual superuser may be POSTGRES_NONROOT_USER. Try both, preferring a
 * role that can create databases.
 */
async function findAdminConnection() {
  const candidates = getConnectionCandidates();
  const errors = [];
  let fallback = null;

  for (const candidate of candidates) {
    try {
      const client = await connect(candidate);
      const { rows } = await client.query(
        `SELECT rolsuper OR rolcreatedb AS can_create
           FROM pg_roles
          WHERE rolname = current_user`,
      );
      if (rows[0]?.can_create) {
        return { client, config: candidate };
      }
      if (!fallback) {
        fallback = { client, config: candidate };
      } else {
        await client.end();
      }
    } catch (err) {
      errors.push(`${candidate.user}: ${err.message}`);
    }
  }

  if (fallback) {
    return fallback;
  }
  throw new Error(
    `Could not connect to PostgreSQL as an administrator. Tried: ${errors.join(
      '; ',
    )}`,
  );
}

async function getDatabaseOwner(admin) {
  const nonRootUser = process.env.POSTGRES_NONROOT_USER;
  if (!nonRootUser) {
    return undefined;
  }
  const { rows } = await admin.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [nonRootUser],
  );
  return rows.length > 0 ? nonRootUser : undefined;
}

async function dropDatabase(admin, databaseName) {
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  } catch (err) {
    // FORCE requires PostgreSQL 13+. Fall back for older servers.
    if (err.code === '42601') {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      return;
    }
    throw err;
  }
}

async function createDatabase(admin, databaseName, owner) {
  const ownerClause = owner ? ` OWNER "${owner}"` : '';
  await admin.query(`CREATE DATABASE "${databaseName}"${ownerClause}`);
}

async function createExtensions(databaseName, extensions, adminConfig) {
  if (extensions.length === 0) {
    return;
  }
  const client = await connect({ ...adminConfig, database: databaseName });
  try {
    for (const extension of extensions) {
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
      } catch (err) {
        throw new Error(
          `Failed to create extension "${extension}" in "${databaseName}": ${err.message}`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

module.exports = async () => {
  loadEnvironment();

  const workerCount = getMaxWorkers();
  const { client: admin, config: adminConfig } = await findAdminConnection();
  try {
    const owner = await getDatabaseOwner(admin);
    console.log(
      `[test-setup] Preparing ${workerCount} isolated database set(s) for parallel tests...`,
    );

    for (let workerId = 1; workerId <= workerCount; workerId++) {
      for (const baseName of DATABASES) {
        const databaseName = getTestDatabaseName(baseName, workerId);
        await dropDatabase(admin, databaseName);
        await createDatabase(admin, databaseName, owner);
        await createExtensions(
          databaseName,
          EXTENSIONS_BY_DATABASE[baseName] || [],
          adminConfig,
        );
      }
    }
    console.log('[test-setup] Test databases are ready.');
  } finally {
    await admin.end();
  }
};
