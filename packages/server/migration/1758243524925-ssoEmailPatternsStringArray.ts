import { MigrationInterface, QueryRunner } from 'typeorm';

export class SsoEmailPatternsStringArray1758243524925
  implements MigrationInterface
{
  name = 'SsoEmailPatternsStringArray1758243524925';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "ssoEmailPatterns"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "ssoEmailPatterns" text array`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "ssoEmailPatterns"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "ssoEmailPatterns" text`,
    );
  }
}
