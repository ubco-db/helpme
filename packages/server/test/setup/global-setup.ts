/**
 * Jest globalSetup script for parallel integration tests.
 *
 * Creates a dedicated PostgreSQL schema for each Jest worker so that
 * workers can run concurrently without data collisions.
 *
 * Schemas are named `test_worker_1`, `test_worker_2`, etc.
 *
 * Uses the superuser (POSTGRES_USER) since schema creation requires
 * elevated privileges that the nonroot user doesn't have.
 */
import { Client } from 'pg';

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load postgres credentials from postgres.env (same as docker-compose uses)
dotenv.config({ path: path.resolve(__dirname, '../../postgres.env') });

const MAX_WORKERS = parseInt(process.env.MAX_TEST_WORKERS || '8');

export default async function globalSetup() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    // Use the superuser for DDL operations (creating schemas)
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: 'test',
  });

  await client.connect();

  try {
    const nonrootUser = process.env.POSTGRES_NONROOT_USER;

    for (let i = 1; i <= MAX_WORKERS; i++) {
      const schema = `test_worker_${i}`;
      // DROP + CREATE to ensure a clean slate each run
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await client.query(`CREATE SCHEMA ${schema}`);
      // Grant usage and create privileges to the nonroot user
      // so TypeORM can create/drop tables within the schema
      await client.query(`GRANT ALL ON SCHEMA ${schema} TO ${nonrootUser}`);
    }
    console.log(
      `Created ${MAX_WORKERS} test worker schemas (granted to ${nonrootUser})`,
    );
  } finally {
    await client.end();
  }
}
