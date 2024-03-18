import { MigrationInterface, QueryRunner } from 'typeorm';

export class addVerifiedToAsync1710210377343 implements MigrationInterface {
  name = 'addVerifiedToAsync1710210377343';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_model" ADD "verified" boolean NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_model" DROP COLUMN "verified"`,
    );
  }
}
