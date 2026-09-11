import { MigrationInterface, QueryRunner } from 'typeorm';

// Single migration for the embeddable assessment feature. It creates the
// final schema directly (question, feedback with durable submission
// history, reasons, review flag, and grading snapshot); this branch has not
// been deployed, so no legacy tables or backfills exist.
export class EmbeddableQuestion1788000000000 implements MigrationInterface {
  name = 'EmbeddableQuestion1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "embeddable_question_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "title" text NOT NULL, "questionText" text NOT NULL, "gradingSettings" jsonb NOT NULL, CONSTRAINT "PK_7221480303ac557d4312f9f7e55" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "embeddable_question_feedback_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "questionId" integer NOT NULL, "userId" integer NOT NULL, "submission" text NOT NULL, "aiFeedback" text NOT NULL, "aiGrade" double precision NOT NULL, "appliedRequirements" text array NOT NULL DEFAULT '{}', "aiModel" text, "maxScore" double precision, "gradingSnapshot" jsonb, "reasons" text array NOT NULL DEFAULT '{}', "needsHumanReview" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_44f928f5436a18d1c85c1152ad9" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" ADD CONSTRAINT "FK_79ca48befc343d6f6957ea87376" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_21ce283653acf7fe839e4b5a298" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57" FOREIGN KEY ("questionId") REFERENCES "embeddable_question_model"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_206d465aab2d93ecc9aac1e76da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_d052d8fe0b07aca9c6f7625ef57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP CONSTRAINT "FK_21ce283653acf7fe839e4b5a298"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_model" DROP CONSTRAINT "FK_79ca48befc343d6f6957ea87376"`,
    );
    await queryRunner.query(`DROP TABLE "embeddable_question_feedback_model"`);
    await queryRunner.query(`DROP TABLE "embeddable_question_model"`);
  }
}
