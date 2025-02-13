import { MigrationInterface, QueryRunner } from 'typeorm';

export class addCalendarStaffModel1737915342299 implements MigrationInterface {
  name = 'addCalendarStaffModel1737915342299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "calendar_staff_model" ("userId" integer NOT NULL, "calendarId" integer NOT NULL, CONSTRAINT "PK_a067936add588bd9f746ac63808" PRIMARY KEY ("userId", "calendarId"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum" RENAME TO "event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced', 'taCheckedOutEventEnd')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum" USING "eventType"::"text"::"public"."event_model_eventtype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum" RENAME TO "alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum" AS ENUM('rephraseQuestion', 'eventEndedCheckoutStaff', 'promptStudentToLeaveQueue')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum" USING "alertType"::"text"::"public"."alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" ADD CONSTRAINT "FK_78291b65a2dda3eebfa7feee08b" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" ADD CONSTRAINT "FK_a8c4e36b296097a832987c9cc52" FOREIGN KEY ("calendarId") REFERENCES "calendar_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" DROP CONSTRAINT "FK_a8c4e36b296097a832987c9cc52"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_staff_model" DROP CONSTRAINT "FK_78291b65a2dda3eebfa7feee08b"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."alert_model_alerttype_enum_old" AS ENUM('rephraseQuestion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "alert_model" ALTER COLUMN "alertType" TYPE "public"."alert_model_alerttype_enum_old" USING "alertType"::"text"::"public"."alert_model_alerttype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."alert_model_alerttype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."alert_model_alerttype_enum_old" RENAME TO "alert_model_alerttype_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum_old" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum_old" USING "eventType"::"text"::"public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_model_eventtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum_old" RENAME TO "event_model_eventtype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "calendar_staff_model"`);
  }
}
