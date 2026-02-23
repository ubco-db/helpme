import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNamePronunciation1771818704948 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD COLUMN IF NOT EXISTS "namePronunciation" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN IF EXISTS "namePronunciation"`,
    );
  }
}
