import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignmentEvaluationEnabled1779068468182
  implements MigrationInterface
{
  name = 'AssignmentEvaluationEnabled1779068468182';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" ADD "assignmentEvaluationEnabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_settings_model" DROP COLUMN "assignmentEvaluationEnabled"`,
    );
  }
}
