import { MigrationInterface, QueryRunner } from 'typeorm';

export class LMSPageBodyDropNotNull1755999708148 implements MigrationInterface {
  name = 'Test1755999708148';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_page_model" ALTER COLUMN "body" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_page_model" ALTER COLUMN "body" SET NOT NULL`,
    );
  }
}
