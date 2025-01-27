import { MigrationInterface, QueryRunner } from 'typeorm';

export class addReadChangelogColumnToUser1732633696315
  implements MigrationInterface
{
  name = 'addReadChangelogColumnToUser1732633696315';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "readChangeLog" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "readChangeLog"`,
    );
  }
}
