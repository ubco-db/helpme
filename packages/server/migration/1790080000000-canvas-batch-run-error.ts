import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanvasBatchRunError1790080000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_run_model" ADD "error" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "canvas_batch_run_model" DROP COLUMN "error"`,
    );
  }
}
