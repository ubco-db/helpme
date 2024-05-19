import { MigrationInterface, QueryRunner } from 'typeorm';

export class chatToken1716144008698 implements MigrationInterface {
  name = 'chatToken1716144008698';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chat_token_model" ("id" SERIAL NOT NULL, "token" text NOT NULL, "used" integer NOT NULL DEFAULT '0', "max_uses" integer NOT NULL DEFAULT '30', "user" integer, CONSTRAINT "UQ_71024eeefbc25279dd420815cf9" UNIQUE ("token"), CONSTRAINT "REL_06d13508f10e479d1f99c2fb30" UNIQUE ("user"), CONSTRAINT "PK_8884fc34ef0c37cee8b84af5b16" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" DROP COLUMN "phoneNotifsEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" ADD CONSTRAINT "FK_06d13508f10e479d1f99c2fb306" FOREIGN KEY ("user") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chat_token_model" DROP CONSTRAINT "FK_06d13508f10e479d1f99c2fb306"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_model" ADD "phoneNotifsEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`DROP TABLE "chat_token_model"`);
  }
}
