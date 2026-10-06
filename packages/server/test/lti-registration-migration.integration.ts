import { DataSource, QueryRunner } from 'typeorm';
import { config } from 'dotenv';
import { MultipleLtiRegistrations1791249527689 } from '../migration/1791249527689-multiple-lti-registrations';

config({ path: 'postgres.env' });

// App fixtures synchronize the new schema; backfill needs the legacy schema.
describe('Multiple LTI registrations migration', () => {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: process.env.POSTGRES_NONROOT_USER,
    password: process.env.POSTGRES_NONROOT_PASSWORD,
    database: 'test',
  });
  const migration = new MultipleLtiRegistrations1791249527689();
  let runner: QueryRunner;

  beforeAll(async () => {
    await dataSource.initialize();
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`CREATE SCHEMA "lti_registration_migration_test"`);
    await runner.query(`SET search_path TO "lti_registration_migration_test"`);
    await runner.query(`CREATE TABLE "lms_org_integration_model" (
      "organizationId" integer NOT NULL,
      "apiPlatform" text NOT NULL,
      "ltiPlatformId" text,
      CONSTRAINT "UQ_bb3df6b55028b05540a07854950" UNIQUE ("ltiPlatformId"),
      PRIMARY KEY ("organizationId", "apiPlatform")
    )`);
    await runner.query(`INSERT INTO "lms_org_integration_model" VALUES
      (1, 'Canvas', 'old-registration-1'),
      (2, 'Canvas', 'old-registration-2'),
      (3, 'Canvas', NULL)`);
  });
  afterAll(async () => {
    if (runner) {
      await runner.query(`SET search_path TO public`);
      await runner.query(
        `DROP SCHEMA "lti_registration_migration_test" CASCADE`,
      );
      await runner.release();
    }
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  it('preserves existing assignments and restores assigned and unassigned organizations on rollback', async () => {
    const original = await runner.query(
      `SELECT * FROM "lms_org_integration_model" ORDER BY "organizationId"`,
    );
    await migration.up(runner);
    expect(
      await runner.query(
        `SELECT * FROM "lti_organization_registration_model" ORDER BY "organizationId"`,
      ),
    ).toEqual(original.filter(({ ltiPlatformId }) => ltiPlatformId !== null));
    await migration.down(runner);
    expect(
      await runner.query(
        `SELECT * FROM "lms_org_integration_model" ORDER BY "organizationId"`,
      ),
    ).toEqual(original);
  });
});
