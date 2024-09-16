import { MigrationInterface, QueryRunner } from 'typeorm';

export class queueInvites1726274305539 implements MigrationInterface {
  name = 'queueInvites1726274305539';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "queue_invite_model" ("queueId" integer NOT NULL, "QRCodeEnabled" boolean NOT NULL DEFAULT true, "isQuestionsVisible" boolean NOT NULL DEFAULT false, "willInviteToCourse" boolean NOT NULL DEFAULT false, "inviteCode" text NOT NULL DEFAULT '', "QRCodeErrorLevel" character varying(1) NOT NULL DEFAULT 'L', CONSTRAINT "REL_4666f20b8ec1107f9973e96606" UNIQUE ("queueId"), CONSTRAINT "PK_4666f20b8ec1107f9973e966062" PRIMARY KEY ("queueId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" ADD CONSTRAINT "FK_4666f20b8ec1107f9973e966062" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "queue_invite_model" DROP CONSTRAINT "FK_4666f20b8ec1107f9973e966062"`,
    );
    await queryRunner.query(`DROP TABLE "queue_invite_model"`);
  }
}
