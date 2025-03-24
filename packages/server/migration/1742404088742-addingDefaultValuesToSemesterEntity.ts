import { MigrationInterface, QueryRunner } from 'typeorm';

export class addingDefaultValuesToSemesterEntity1742404088742
  implements MigrationInterface
{
  name = 'addingDefaultValuesToSemesterEntity1742404088742';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "name" SET DEFAULT 'Legacy Semester'`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" SET DEFAULT ('now'::text)::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" SET DEFAULT ('now'::text)::date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "endDate" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "startDate" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "name" DROP DEFAULT`,
    );
  }
}
