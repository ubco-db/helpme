import { MigrationInterface, QueryRunner } from 'typeorm';

// Revives the legacy reason/review fields for the grading contract: they were
// dropped in the embeddable-grading-contract migration and are restored here
// for validated model-reported reason codes and a human-review flag.
export class RestoreGradingReasons1789080366000 implements MigrationInterface {
  name = 'RestoreGradingReasons1789080366000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "reasons" text array NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" ADD "needsHumanReview" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "needsHumanReview"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddable_question_feedback_model" DROP COLUMN "reasons"`,
    );
  }
}
