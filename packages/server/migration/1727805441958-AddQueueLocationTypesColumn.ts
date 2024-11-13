import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueueLocationTypesColumn1727805441958
  implements MigrationInterface
{
  name = 'AddQueueLocationTypesColumn1727805441958';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_model" ADD "type" character varying NOT NULL DEFAULT 'hybrid'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_model" DROP COLUMN "type"`);
  }
}
