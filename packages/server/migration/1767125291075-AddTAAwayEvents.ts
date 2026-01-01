import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTAAwayEvents1767125291075 implements MigrationInterface {
  name = 'AddTAAwayEvents1767125291075';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum" RENAME TO "event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced', 'taCheckedOutEventEnd', 'taMarkedSelfAway', 'taMarkedSelfBack')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum" USING "eventType"::"text"::"public"."event_model_eventtype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."event_model_eventtype_enum_old"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum_old" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutForced', 'taCheckedOutEventEnd')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum_old" USING "eventType"::"text"::"public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_model_eventtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum_old" RENAME TO "event_model_eventtype_enum"`,
    );
  }
}
