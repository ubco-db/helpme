/**
 * Jest globalTeardown script for parallel integration tests.
 *
 * Drops all worker schemas after tests complete to leave the
 * `test` database clean.
 *
 * Uses the superuser (POSTGRES_USER) since schema deletion requires
 * elevated privileges that the nonroot user doesn't have.
 */
import { Client } from 'pg';

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load postgres credentials from postgres.env (same as docker-compose uses)
dotenv.config({ path: path.resolve(__dirname, '../../postgres.env') });

const MAX_WORKERS = parseInt(process.env.MAX_TEST_WORKERS || '8');

export default async function globalTeardown() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    // Use the superuser for DDL operations (dropping schemas)
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: 'test',
  });

  await client.connect();

  try {
    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schema = `test_worker_${i}`;
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }
    console.log(`Dropped ${MAX_WORKERS} test worker schemas`);
  } finally {
    await client.end();
  }
}
