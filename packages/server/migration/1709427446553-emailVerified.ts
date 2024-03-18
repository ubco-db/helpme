import { MigrationInterface, QueryRunner } from 'typeorm';

export class emailVerified1709427446553 implements MigrationInterface {
  name = 'emailVerified1709427446553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "emailVerified" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "emailVerified"`,
    );
  }
}
