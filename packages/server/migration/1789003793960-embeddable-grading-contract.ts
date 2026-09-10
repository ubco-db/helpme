import { MigrationInterface, QueryRunner } from 'typeorm';

// Generated with `yarn migration:generate ./migration/embeddable-grading-contract`
// against a database at the committed pre-feature schema (everything up to and
// including EmbeddableQuestion1788000000000), plus two adjustments:
// 1. New NOT NULL columns (title, gradingSettings) are added nullable and
//    backfilled with valid default grading settings before the NOT NULL
//    constraints are applied (legacy grading data is not preserved: arbitrary
//    legacy text, score lists, and sentence bounds are not reused).
// 2. The legacy embeddable_grading_profile_model table is dropped; TypeORM
//    cannot see it because the entity no longer exists, so the generator
//    never emitted this part.
export class EmbeddableGradingContract1789003793960 implements MigrationInterface {
  name = 'EmbeddableGradingContract1789003793960';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57"`,
    );
    await queryRunner.query(
      `CREATE TABLE "embeddable_quiz_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "title" text NOT NULL, "objective" text NOT NULL DEFAULT '', "background" text NOT NULL DEFAULT '', CONSTRAINT "UQ_9f4650325d03a15469129e4c447" UNIQUE ("id", "courseId"), CONSTRAINT "PK_79f06a4ebfe21f33c3771c0d1f2" PRIMARY KEY ("id"))`,
    );

    // Added nullable (instead of the generator's plain NOT NULL add) so legacy
    // rows can be backfilled before the constraints below.
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "title" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "quizId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "gradingSettings" jsonb`,
    );

    // Data step: every legacy question receives the same valid, professor-
    // editable default grading settings that satisfy the settled contract.
    // Legacy grading data is not preserved (arbitrary legacy text, score
    // lists, and sentence bounds are not reused); blank answers are handled
    // by the grading engine itself, so no blank check or reason codes exist.
    await queryRunner.query(`
      UPDATE "embeddable_question_model"
      SET "title" = LEFT(COALESCE(NULLIF(BTRIM("name"), ''), 'Question'), 255),
          "gradingSettings" = jsonb_build_object(
            'rubric', 'Grade the answer against the question.',
            'feedbackInstructions', '',
            'finalGradingInstructions', '',
            'scoreScale', jsonb_build_object('kind', 'values', 'values', jsonb_build_array(0, 1, 2)),
            'checks', '[]'::jsonb
          )
    `);

    // The profile entity no longer exists, so drop the legacy table.
    await queryRunner.query(
      `ALTER TABLE "embeddable_grading_profile_model" DROP CONSTRAINT "FK_8c119142aa8eac1a10d21b1616d"`,
    );
    await queryRunner.query(`DROP TABLE "embeddable_grading_profile_model"`);

    // Legacy question columns are replaced by title/gradingSettings.
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "minSentences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "maxSentences"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "criteriaText"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "instructions"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "needsHumanReview"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "reasons"`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ALTER COLUMN "title" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ALTER COLUMN "gradingSettings" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "appliedRequirements" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "maxScore" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "gradingSnapshot" jsonb`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD CONSTRAINT "UQ_de49f6892ea5e99da11dec34272" UNIQUE ("id", "courseId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_quiz_model" ADD CONSTRAINT "FK_5e3cd4db046d9d89b4e5afa7c8a" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD CONSTRAINT "FK_dca43fcf1384917e91013775f0c" FOREIGN KEY ("quizId") REFERENCES "embeddable_quiz_model"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP CONSTRAINT "FK_dca43fcf1384917e91013775f0c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_quiz_model" DROP CONSTRAINT "FK_5e3cd4db046d9d89b4e5afa7c8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP CONSTRAINT "UQ_de49f6892ea5e99da11dec34272"`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "gradingSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "maxScore"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "appliedRequirements"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "reasons" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "needsHumanReview" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "name" text`,
    );
    // criteriaText was NOT NULL in the predecessor schema, so it is added
    // nullable first and backfilled before the constraint is restored.
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "criteriaText" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "instructions" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "minSentences" integer NOT NULL DEFAULT '3'`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD "maxSentences" integer NOT NULL DEFAULT '5'`,
    );

    // --- Data step: settings -> legacy columns (lossy; legacy grading data is
    // not faithfully restorable) ---
    await queryRunner.query(`
      UPDATE "embeddable_question_model"
      SET "name" = "title",
          "criteriaText" = COALESCE(NULLIF("gradingSettings"->>'rubric', ''), ''),
          "instructions" = NULLIF("gradingSettings"->>'feedbackInstructions', '')
    `);
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ALTER COLUMN "criteriaText" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "gradingSettings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "quizId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP COLUMN "title"`,
    );

    await queryRunner.query(`DROP TABLE "embeddable_quiz_model"`);

    // Recreate the legacy profile table so the predecessor schema is whole
    // again. Its rows are not restored.
    await queryRunner.query(
      `CREATE TABLE "embeddable_grading_profile_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "policyKind" text NOT NULL DEFAULT 'generic', "systemPrompt" text NOT NULL, "allowedScores" double precision array NOT NULL, "reasonCodes" text array NOT NULL, CONSTRAINT "UQ_8c119142aa8eac1a10d21b1616d" UNIQUE ("courseId"), CONSTRAINT "PK_f1d153b28ad0a413b0a81805aaf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_grading_profile_model" ADD CONSTRAINT "FK_8c119142aa8eac1a10d21b1616d" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
