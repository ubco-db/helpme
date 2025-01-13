import { MigrationInterface, QueryRunner } from 'typeorm';

export class accurateHelptimesWaittimes1731187674872
  implements MigrationInterface
{
  name = 'accurateHelptimesWaittimes1731187674872';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "pausedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "lastReadyAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "waitTime" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "helpTime" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "helpTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "waitTime"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "lastReadyAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "pausedAt" TIMESTAMP`,
    );
  }
}
