import { config } from 'dotenv';
import * as fs from 'fs';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import {
  QuestionGradingSettings,
  questionGradingSettingsSchema,
} from '@koh/common';
import { EmbeddableQuestion1788000000000 } from '../migration/1788000000000-embeddable-question';

// Load the standard server env files (.env, falling back to .env.development,
// then postgres.env) exactly like ormconfig.ts.
if (fs.existsSync('.env')) {
  config();
} else {
  config({ path: '.env.development' });
}
if (fs.existsSync('postgres.env')) {
  config({ path: 'postgres.env' });
}

// Runs the real final migration against a uniquely named disposable database
// created and dropped by this test alone; no shared database is touched.
const TEST_DB = `helpme_embeddable_migration_${process.pid}`;

// The pg client option is "user"; the typeorm option is "username".
const pgConnection = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
};

const EMBEDDABLE_TABLES = [
  'embeddable_quiz_model',
  'embeddable_question_model',
  'embeddable_question_feedback_model',
];

// Columns and foreign keys of the embeddable tables, normalized by SQL
// ordering so they can be compared across a down/up roundtrip.
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

// The settled grading-settings contract drops finalGradingInstructions; it is
// omitted here and stubbed only for the one-time schema check below, until the
// shared schema is updated at integration.
const REALISTIC_SETTINGS: Omit<
  QuestionGradingSettings,
  'finalGradingInstructions'
> = {
  rubric: 'Award full marks for a complete, accurate answer.',
  feedbackInstructions: 'Explain what the answer is missing.',
  scoreScale: { kind: 'values', values: [0, 1, 2] },
  checks: [{ kind: 'minimum_sentences', minimum: 3, scoreCap: 1 }],
};
questionGradingSettingsSchema.parse({
  ...REALISTIC_SETTINGS,
  finalGradingInstructions: '',
});

const withAdminClient = async <T>(
  database: string,
  run: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = new Client({ ...pgConnection, database });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
};

describe('Embeddable grading migration', () => {
  let ds: DataSource;
  let finalSnapshot: unknown[];
  let createdDb = false;

  beforeAll(async () => {
    await withAdminClient('postgres', (admin) =>
      admin.query(`CREATE DATABASE "${TEST_DB}"`),
    );
    createdDb = true;

    // Minimal FK parents for the embeddable tables, in the disposable DB.
    await withAdminClient(TEST_DB, (client) =>
      client.query(
        `CREATE TABLE "course_model" ("id" SERIAL PRIMARY KEY);
         CREATE TABLE "user_model" ("id" SERIAL PRIMARY KEY)`,
      ),
    );

    ds = new DataSource({
      type: 'postgres',
      ...pgConnection,
      username: pgConnection.user,
      database: TEST_DB,
      migrations: [EmbeddableQuestion1788000000000],
    });
    await ds.initialize();
    await ds.runMigrations();
    finalSnapshot = await schemaSnapshot(ds);
  }, 120000);

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
    // Drop only the database this run created, even after a failed suite.
    if (createdDb) {
      await withAdminClient('postgres', (admin) =>
        admin.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`),
      );
    }
  }, 60000);

  it('creates the settled final schema', async () => {
    const columns = await ds.query<Record<string, unknown>[]>(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = ANY($1::text[]) AND table_schema = 'public'
       ORDER BY table_name, column_name`,
      [EMBEDDABLE_TABLES],
    );
    const column = (table: string, name: string) =>
      columns.find((c) => c.table_name === table && c.column_name === name);

    expect(column('embeddable_quiz_model', 'title')).toMatchObject({
      data_type: 'text',
      is_nullable: 'NO',
    });
    expect(column('embeddable_question_model', 'title')).toMatchObject({
      data_type: 'text',
      is_nullable: 'NO',
    });
    expect(
      column('embeddable_question_model', 'gradingSettings'),
    ).toMatchObject({ data_type: 'jsonb', is_nullable: 'NO' });

    expect(
      column('embeddable_question_feedback_model', 'submission'),
    ).toMatchObject({ data_type: 'text', is_nullable: 'NO' });
    expect(
      column('embeddable_question_feedback_model', 'aiFeedback'),
    ).toMatchObject({ data_type: 'text', is_nullable: 'NO' });
    expect(
      column('embeddable_question_feedback_model', 'aiGrade'),
    ).toMatchObject({ data_type: 'double precision', is_nullable: 'NO' });
    expect(
      column('embeddable_question_feedback_model', 'appliedRequirements'),
    ).toMatchObject({ data_type: 'ARRAY', is_nullable: 'NO' });
    expect(
      column('embeddable_question_feedback_model', 'maxScore'),
    ).toMatchObject({ data_type: 'double precision', is_nullable: 'YES' });
    expect(
      column('embeddable_question_feedback_model', 'gradingSnapshot'),
    ).toMatchObject({ data_type: 'jsonb', is_nullable: 'YES' });
    expect(
      column('embeddable_question_feedback_model', 'reasons'),
    ).toMatchObject({ data_type: 'ARRAY', is_nullable: 'NO' });
    expect(
      column('embeddable_question_feedback_model', 'needsHumanReview'),
    ).toMatchObject({ data_type: 'boolean', is_nullable: 'NO' });

    const [, fks] = await schemaSnapshot(ds);
    expect(fks).toEqual([
      {
        table_name: 'embeddable_question_feedback_model',
        conname: 'FK_206d465aab2d93ecc9aac1e76da',
        definition:
          'FOREIGN KEY ("userId") REFERENCES user_model(id) ON DELETE CASCADE',
      },
      {
        table_name: 'embeddable_question_feedback_model',
        conname: 'FK_21ce283653acf7fe839e4b5a298',
        definition:
          'FOREIGN KEY ("courseId") REFERENCES course_model(id) ON DELETE CASCADE',
      },
      {
        table_name: 'embeddable_question_feedback_model',
        conname: 'FK_d052d8fe0b07aca9c6f7625ef57',
        definition:
          'FOREIGN KEY ("questionId") REFERENCES embeddable_question_model(id) ON DELETE RESTRICT',
      },
      {
        table_name: 'embeddable_question_model',
        conname: 'FK_79ca48befc343d6f6957ea87376',
        definition:
          'FOREIGN KEY ("courseId") REFERENCES course_model(id) ON DELETE CASCADE',
      },
      {
        table_name: 'embeddable_question_model',
        conname: 'FK_dca43fcf1384917e91013775f0c',
        definition:
          'FOREIGN KEY ("quizId") REFERENCES embeddable_quiz_model(id) ON DELETE RESTRICT',
      },
      {
        table_name: 'embeddable_quiz_model',
        conname: 'FK_5e3cd4db046d9d89b4e5afa7c8a',
        definition:
          'FOREIGN KEY ("courseId") REFERENCES course_model(id) ON DELETE CASCADE',
      },
    ]);
  });

  it('persists realistic submissions with full grading history', async () => {
    await ds.query(
      `INSERT INTO "course_model" ("id") OVERRIDING SYSTEM VALUE VALUES (1)`,
    );
    await ds.query(
      `INSERT INTO "user_model" ("id") OVERRIDING SYSTEM VALUE VALUES (1)`,
    );
    await ds.query(
      `INSERT INTO "embeddable_quiz_model" ("id", "courseId", "title", "objective", "background")
       OVERRIDING SYSTEM VALUE VALUES (1, 1, 'Reflection quiz', 'Practice reflection', 'Week 1 readings')`,
    );
    await ds.query(
      `INSERT INTO "embeddable_question_model" ("id", "courseId", "title", "questionText", "quizId", "gradingSettings")
       OVERRIDING SYSTEM VALUE VALUES (1, 1, 'Passage response', 'What does the passage show?', 1, $1::jsonb)`,
      [JSON.stringify(REALISTIC_SETTINGS)],
    );
    await ds.query(
      `INSERT INTO "embeddable_question_feedback_model" ("courseId", "questionId", "userId", "submission", "aiFeedback", "aiGrade", "appliedRequirements", "aiModel", "maxScore", "gradingSnapshot", "reasons", "needsHumanReview")
       VALUES (1, 1, 1, 'The passage shows a conflict.', 'Strong answer; cite the passage next time.', 2, '{}', 'glm-test-model', 2, $1::jsonb, '{The answer addresses the rubric but cites no passage details,Feedback stays grounded in the submission text}', true)`,
      [
        JSON.stringify({
          version: 1,
          questionText: 'What does the passage show?',
          gradingSettings: REALISTIC_SETTINGS,
          quizContext: {
            id: 1,
            courseId: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            title: 'Reflection quiz',
            objective: 'Practice reflection',
            background: 'Week 1 readings',
          },
        }),
      ],
    );

    const feedback = await ds.query<Record<string, unknown>[]>(
      `SELECT * FROM "embeddable_question_feedback_model"`,
    );
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({
      submission: 'The passage shows a conflict.',
      aiFeedback: 'Strong answer; cite the passage next time.',
      aiGrade: 2,
      appliedRequirements: [],
      aiModel: 'glm-test-model',
      maxScore: 2,
      reasons: [
        'The answer addresses the rubric but cites no passage details',
        'Feedback stays grounded in the submission text',
      ],
      needsHumanReview: true,
    });
    // The snapshot is stored as opaque historical JSON and comes back intact.
    expect(feedback[0].gradingSnapshot).toMatchObject({
      version: 1,
      questionText: 'What does the passage show?',
      gradingSettings: REALISTIC_SETTINGS,
    });

    // RESTRICT protects rows that feedback still references...
    await expect(
      ds.query(`DELETE FROM "embeddable_question_model" WHERE "id" = 1`),
    ).rejects.toMatchObject({ code: '23503' });
    // ...and rows that a question links to.
    await expect(
      ds.query(`DELETE FROM "embeddable_quiz_model" WHERE "id" = 1`),
    ).rejects.toMatchObject({ code: '23503' });

    // Deleting the course cascades away the whole feature's rows.
    await ds.query(`DELETE FROM "course_model" WHERE "id" = 1`);
    const remaining = await ds.query<{ count: string }[]>(
      `SELECT count(*) AS count FROM "embeddable_question_feedback_model"`,
    );
    expect(remaining[0].count).toBe('0');
  });

  it('roundtrips down/up into an equivalent schema', async () => {
    await ds.undoLastMigration();
    const tables = await ds.query<{ count: string }[]>(
      `SELECT count(*) AS count FROM information_schema.tables
       WHERE table_name = ANY($1::text[]) AND table_schema = 'public'`,
      [EMBEDDABLE_TABLES],
    );
    expect(tables[0].count).toBe('0');

    await ds.runMigrations();
    expect(await schemaSnapshot(ds)).toEqual(finalSnapshot);
  });
});
