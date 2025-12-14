import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAsyncQuestionAlertType1755000000000
  implements MigrationInterface
{
  name = 'AddAsyncQuestionAlertType1755000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum" RENAME TO "alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue', 'documentProcessed', 'asyncQuestionUpdate')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum" USING "alertType"::text::"public"."alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_alerttype_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum_old" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue', 'documentProcessed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum_old" USING "alertType"::text::"public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_model_alerttype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum_old" RENAME TO "alert_model_alerttype_enum"`,
    );
  }
}
