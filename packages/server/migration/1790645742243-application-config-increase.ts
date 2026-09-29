import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplicationConfigIncrease1790645742243 implements MigrationInterface {
  name = 'ApplicationConfigIncrease1790645742243';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_async_questions" SET DEFAULT '1000'`,
    );
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_questions_per_queue" SET DEFAULT '50'`,
    );
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_semesters" SET DEFAULT '100'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_semesters" SET DEFAULT '40'`,
    );
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_questions_per_queue" SET DEFAULT '30'`,
    );
    await queryRunner.query(
      `ALTER TABLE "config_model" ALTER COLUMN "max_async_questions" SET DEFAULT '100'`,
    );
  }
}
