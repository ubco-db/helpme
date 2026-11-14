import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanvasBatchGrading1789763948908 implements MigrationInterface {
  name = 'CanvasBatchGrading1789763948908';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "canvas_batch_run_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "courseId" integer NOT NULL, "canvasQuizId" integer NOT NULL, "assignmentId" integer NOT NULL, "canvasQuizTitle" text NOT NULL, "status" text NOT NULL, "gradingMode" text NOT NULL, "instruction" text NOT NULL, "speedGraderUrl" text NOT NULL, "createdByUserId" integer NOT NULL, "questions" jsonb NOT NULL, "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_ec8992f2177f809b59ccad28118" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_canvas_batch_run_active" ON "canvas_batch_run_model" ("courseId", "canvasQuizId") WHERE "status" = 'running'`,
    );
    await queryRunner.query(
      `CREATE TABLE "canvas_batch_attempt_model" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "runId" integer NOT NULL, "quizSubmissionId" integer NOT NULL, "canvasUserId" integer NOT NULL, "attemptNumber" integer NOT NULL, "status" text NOT NULL, "readable" boolean NOT NULL DEFAULT false, "questions" jsonb NOT NULL, "error" text, CONSTRAINT "PK_679b1345aa25eda30cdb24c50b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_canvas_batch_attempt_identity" ON "canvas_batch_attempt_model" ("runId", "quizSubmissionId", "attemptNumber") `,
    );
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_run_model" ADD CONSTRAINT "FK_0f1db72740c84933b1f5cfc9f14" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_attempt_model" ADD CONSTRAINT "FK_dde1a97c661fbce1d3083ce5750" FOREIGN KEY ("runId") REFERENCES "canvas_batch_run_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_attempt_model" DROP CONSTRAINT "FK_dde1a97c661fbce1d3083ce5750"`,
    );
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_run_model" DROP CONSTRAINT "FK_0f1db72740c84933b1f5cfc9f14"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_canvas_batch_attempt_identity"`,
    );
    await queryRunner.query(`DROP TABLE "canvas_batch_attempt_model"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_canvas_batch_run_active"`,
    );
    await queryRunner.query(`DROP TABLE "canvas_batch_run_model"`);
  }
}
