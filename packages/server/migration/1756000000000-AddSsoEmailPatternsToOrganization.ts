import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSsoEmailPatternsToOrganization1756000000000
  implements MigrationInterface
{
  name = 'AddSsoEmailPatternsToOrganization1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "ssoEmailPatterns" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "ssoEmailPatterns"`,
    );
  }
}
