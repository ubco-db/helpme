import { questionGradingSettingsSchema } from '@koh/common';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { EmbeddableQuestion1788000000000 } from '../migration/1788000000000-embeddable-question';
import { EmbeddableGradingContract1789003793960 } from '../migration/1789003793960-embeddable-grading-contract';

// Runs the real generated migration against a uniquely named disposable
// database created for this run and dropped afterwards, seeded with
// legacy-shaped data, and checks the settled settings contract plus an
// up/down roundtrip. No shared or env-selected database is ever touched.
const TEST_DB = `helpme_embeddable_migration_${process.pid}`;

const connection = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
  password: process.env.POSTGRES_PASSWORD,
};
// typeorm option is "username"; the pg client option is "user".
const pgUser = process.env.POSTGRES_USER;

const EMBEDDABLE_TABLES = [
  'embeddable_question_model',
  'embeddable_question_feedback_model',
  'embeddable_quiz_model',
  'embeddable_grading_profile_model',
];

// Columns + constraints of the embeddable tables; compared across the
// migration roundtrip. Ordering is normalized by SQL so ADD COLUMN position
// differences do not matter.
const schemaSnapshot = (ds: DataSource) =>
  Promise.all([
    ds.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = ANY($1::text[]) AND table_schema = 'public'
       ORDER BY table_name, column_name`,
      [EMBEDDABLE_TABLES],
    ),
    ds.query(
      `SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conrelid::regclass::text = ANY($1::text[]) AND contype = 'f'
       ORDER BY table_name, conname`,
      [EMBEDDABLE_TABLES],
    ),
  ]);

const migrate = async (
  migrations: (typeof EmbeddableQuestion1788000000000)[],
) => {
  const ds = new DataSource({
    type: 'postgres',
    ...connection,
    database: TEST_DB,
    username: pgUser,
    migrations,
  });
  await ds.initialize();
  await ds.runMigrations();
  return ds;
};

const DEFAULT_SETTINGS = {
  rubric: 'Grade the answer against the question.',
  feedbackInstructions: '',
  finalGradingInstructions: '',
  scoreScale: { kind: 'values', values: [0, 1, 2] },
  checks: [],
};

describe('Embeddable grading migration', () => {
  let baselineSnapshot: unknown[];
  let finalSnapshot: unknown[];
  let ds: DataSource;
  let createdDb = false;

  beforeAll(async () => {
    const admin = new Client({
      ...connection,
      user: pgUser,
      database: 'postgres',
    });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${TEST_DB}"`);
    createdDb = true;
    await admin.end();

    // Minimal FK parents for the embeddable tables (predecessor schema).
    const parents = new Client({
      ...connection,
      user: pgUser,
      database: TEST_DB,
    });
    await parents.connect();
    await parents.query(
      `CREATE TABLE "course_model" ("id" SERIAL PRIMARY KEY);
       CREATE TABLE "user_model" ("id" SERIAL PRIMARY KEY)`,
    );
    await parents.end();

    const baseline = await migrate([EmbeddableQuestion1788000000000]);
    await baseline.query(
      `INSERT INTO "course_model" ("id") OVERRIDING SYSTEM VALUE VALUES (1), (2)`,
    );
    await baseline.query(
      `INSERT INTO "user_model" ("id") OVERRIDING SYSTEM VALUE VALUES (1)`,
    );
    // A legacy profile whose data must not leak into the migrated settings.
    await baseline.query(
      `INSERT INTO "embeddable_grading_profile_model" ("courseId", "policyKind", "systemPrompt", "allowedScores", "reasonCodes")
       VALUES (1, 'indg-reflection', 'Explain feedback kindly.', '{0}', '{too_short,above_suggested_length,indigenous_capitalization}')`,
    );
    // Legacy shapes that must not reach the migrated settings unchanged:
    // over-length title/criteria text, empty name, impossible sentence bounds.
    await baseline.query(
      `INSERT INTO "embeddable_question_model" ("id", "courseId", "name", "questionText", "criteriaText", "instructions", "minSentences", "maxSentences")
       OVERRIDING SYSTEM VALUE
       VALUES (1, 1, repeat('x', 300), 'What does the passage show?', repeat('y', 30000), 'Be concise.', 6, 3),
              (2, 1, '', 'Answer freely.', '', NULL, 3, 5)`,
    );
    await baseline.query(
      `INSERT INTO "embeddable_question_feedback_model" ("courseId", "questionId", "userId", "submission", "aiFeedback", "aiGrade", "reasons", "needsHumanReview")
       VALUES (1, 1, 1, 'A legacy answer.', 'Legacy feedback.', 2, '{too_short}', false)`,
    );
    baselineSnapshot = await schemaSnapshot(baseline);
    await baseline.destroy();

    ds = await migrate([
      EmbeddableQuestion1788000000000,
      EmbeddableGradingContract1789003793960,
    ]);
    finalSnapshot = await schemaSnapshot(ds);
  }, 120000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
    // Drop only the database this run created, even after a failed suite.
    if (createdDb) {
      const admin = new Client({
        ...connection,
        user: pgUser,
        database: 'postgres',
      });
      await admin.connect();
      await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
      await admin.end();
    }
  }, 30000);

  it('backfills valid default settings and keeps restrict protections', async () => {
    const rows = await ds.query<{ title: string; gradingSettings: unknown }[]>(
      `SELECT "title", "gradingSettings" FROM "embeddable_question_model" ORDER BY "id"`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // Parse every migrated settings blob through the actual common schema.
      expect(
        questionGradingSettingsSchema.safeParse(row.gradingSettings).success,
      ).toBe(true);
      expect(row.gradingSettings).toEqual(DEFAULT_SETTINGS);
    }
    expect(rows[0].title).toBe('x'.repeat(255));
    expect(rows[1].title).toBe('Question');

    // Public feedback drops reasons/needsHumanReview and gains
    // appliedRequirements/maxScore/gradingSnapshot.
    const feedback = await ds.query<Record<string, unknown>[]>(
      `SELECT * FROM "embeddable_question_feedback_model"`,
    );
    expect(feedback[0]).toMatchObject({
      appliedRequirements: [],
      maxScore: null,
      gradingSnapshot: null,
    });
    expect(Object.keys(feedback[0])).not.toContain('reasons');
    expect(Object.keys(feedback[0])).not.toContain('needsHumanReview');

    // The RESTRICT foreign keys protect directly referenced rows.
    await ds.query(
      `INSERT INTO "embeddable_quiz_model" ("courseId", "title") VALUES (1, 'Legacy quiz')`,
    );
    await ds.query(
      `UPDATE "embeddable_question_model" SET "quizId" = 1 WHERE "id" = 1`,
    );
    await expect(
      ds.query(`DELETE FROM "embeddable_quiz_model" WHERE "id" = 1`),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      ds.query(`DELETE FROM "embeddable_question_model" WHERE "id" = 1`),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('roundtrips down/up and restores the predecessor schema', async () => {
    await ds.undoLastMigration();
    expect(await schemaSnapshot(ds)).toEqual(baselineSnapshot);
    // The down pass backfills the legacy columns from the settings it removes.
    const restored = await ds.query<Record<string, unknown>[]>(
      `SELECT "name", "criteriaText" FROM "embeddable_question_model" WHERE "id" = 1`,
    );
    expect(restored[0]).toEqual({
      name: 'x'.repeat(255),
      criteriaText: 'Grade the answer against the question.',
    });

    await ds.runMigrations();
    expect(await schemaSnapshot(ds)).toEqual(finalSnapshot);
    const rows = await ds.query<{ gradingSettings: unknown }[]>(
      `SELECT "gradingSettings" FROM "embeddable_question_model" WHERE "id" = 1`,
    );
    expect(
      questionGradingSettingsSchema.safeParse(rows[0].gradingSettings).success,
    ).toBe(true);
    expect(rows[0].gradingSettings).toEqual(DEFAULT_SETTINGS);
  });
});
