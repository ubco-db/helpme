import { MigrationInterface, QueryRunner } from 'typeorm';

export class addZoomLinkToQueues1728590701099 implements MigrationInterface {
  name = 'addZoomLinkToQueues1728590701099';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_model" ADD "zoomLink" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "queue_model" DROP COLUMN "zoomLink"`);
  }
}
