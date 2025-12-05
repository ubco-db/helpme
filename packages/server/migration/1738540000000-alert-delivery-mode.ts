import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertDeliveryMode1738540000000 implements MigrationInterface {
  name = 'AlertDeliveryMode1738540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum" RENAME TO "alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue', 'documentProcessed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum" USING "alertType"::text::"public"."alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_alerttype_enum_old"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_deliverymode_enum" AS ENUM('modal', 'feed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ADD "deliveryMode" "public"."alert_model_deliverymode_enum" NOT NULL DEFAULT 'modal'`,
    );
    await queryRunner.query(`ALTER TABLE "alert_model" ADD "readAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "alert_model" DROP COLUMN "readAt"`);
    await queryRunner.query(
      `ALTER TABLE "alert_model" DROP COLUMN "deliveryMode"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_deliverymode_enum"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum_old" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue')`,
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
