import { MigrationInterface, QueryRunner } from 'typeorm';

export class calendarNotifications1724705946207 implements MigrationInterface {
  name = 'calendarNotifications1724705946207';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD "startDate" date`,
    );
    await queryRunner.query(`ALTER TABLE "calendar_model" ADD "endDate" date`);
    await queryRunner.query(
      `CREATE TYPE "public"."calendar_model_locationtype_enum" AS ENUM('in-person', 'online', 'hybrid')`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD "locationType" "public"."calendar_model_locationtype_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD "locationOnline" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD "locationInPerson" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP COLUMN "locationInPerson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP COLUMN "locationOnline"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP COLUMN "locationType"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."calendar_model_locationtype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP COLUMN "endDate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "calendar_model" DROP COLUMN "startDate"`,
    );
  }
}
