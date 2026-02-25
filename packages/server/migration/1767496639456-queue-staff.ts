import { MigrationInterface, QueryRunner } from 'typeorm';

export class QueueStaff1767496639456 implements MigrationInterface {
  name = 'QueueStaff1767496639456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."queue_staff_model_extratastatus_enum" AS ENUM('Helping student in another queue', 'Helping student in another course', 'Away')`,
    );
    await queryRunner.query(
      `CREATE TABLE "queue_staff_model" ("queueId" integer NOT NULL, "userId" integer NOT NULL, "extraTAStatus" "public"."queue_staff_model_extratastatus_enum", CONSTRAINT "PK_ee767b35ad26ac4d21d802eaf21" PRIMARY KEY ("queueId", "userId"))`,
    );
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
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" ADD CONSTRAINT "FK_62c30a81d39c7c9c54c4270cf49" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" ADD CONSTRAINT "FK_5ef9ec21c1c52735e74310cd149" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" DROP CONSTRAINT "FK_5ef9ec21c1c52735e74310cd149"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_staff_model" DROP CONSTRAINT "FK_62c30a81d39c7c9c54c4270cf49"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_model_eventtype_enum_old" AS ENUM('taCheckedIn', 'taCheckedOut', 'taCheckedOutEventEnd', 'taCheckedOutForced')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_model" ALTER COLUMN "eventType" TYPE "public"."event_model_eventtype_enum_old" USING "eventType"::"text"::"public"."event_model_eventtype_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_model_eventtype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."event_model_eventtype_enum_old" RENAME TO "event_model_eventtype_enum"`,
    );
    await queryRunner.query(`DROP TABLE "queue_staff_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."queue_staff_model_extratastatus_enum"`,
    );
  }
}
