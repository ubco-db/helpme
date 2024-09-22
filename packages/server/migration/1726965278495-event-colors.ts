import { MigrationInterface, QueryRunner } from 'typeorm';

export class eventColors1726965278495 implements MigrationInterface {
  name = 'eventColors1726965278495';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calendar_model" ADD "color" character varying(7) DEFAULT '#3788d8'`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "UQ_4666f20b8ec1107f9973e966062" UNIQUE ("queueId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "UQ_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "calendar_model" DROP COLUMN "color"`);
  }
}
