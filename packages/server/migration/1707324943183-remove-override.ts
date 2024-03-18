import { MigrationInterface, QueryRunner } from 'typeorm';

export class removeOverride1707324943183 implements MigrationInterface {
  name = 'removeOverride1707324943183';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP COLUMN "override"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD "override" boolean NOT NULL DEFAULT false`,
    );
  }
}
