import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptionalSemesterDates1757615312881 implements MigrationInterface {
  name = 'OptionalSemesterDates1757615312881';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" SET DEFAULT ('now'::text)::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" SET DEFAULT ('now'::text)::date`,
    );
  }
}
