import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameEssayEvaluationColumn1778520300000 implements MigrationInterface {
  name = 'RenameEssayEvaluationColumn1778520300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" RENAME COLUMN "essayEvaluationEnabled" TO "assignmentEvaluationEnabled"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" RENAME COLUMN "assignmentEvaluationEnabled" TO "essayEvaluationEnabled"`,
    );
  }
}
