import { MigrationInterface, QueryRunner } from 'typeorm';

export class addedZoomlinkToQueues1728522732260 implements MigrationInterface {
  name = 'addedZoomlinkToQueues1728522732260';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_model" ADD "zoomLink" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_model" DROP COLUMN "zoomLink"`);
  }
}
