import { MigrationInterface, QueryRunner } from 'typeorm';

export class LmsSelectedResourceTypes1751656307001
  implements MigrationInterface
{
  name = 'LmsSelectedResourceTypes1751656307001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" AS ENUM('assignments', 'announcements')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD "selectedResourceTypes" "public"."lms_course_integration_model_selectedresourcetypes_enum" array NOT NULL DEFAULT '{assignments,announcements}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP COLUMN "selectedResourceTypes"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum"`,
    );
  }
}
