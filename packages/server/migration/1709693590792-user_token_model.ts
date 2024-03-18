import { MigrationInterface, QueryRunner } from 'typeorm';

export class userTokenModel1709693590792 implements MigrationInterface {
  name = 'userTokenModel1709693590792';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_token_model" ("id" SERIAL NOT NULL, "token" text NOT NULL, "created_at" bigint NOT NULL, "expires_at" bigint NOT NULL, "token_type" text NOT NULL DEFAULT 'EMAIL_VERIFICATION', "token_action" text NOT NULL DEFAULT 'ACTION_PENDING', "userId" integer, CONSTRAINT "PK_1698265c5483235eabd11cf56f6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(`DROP TABLE "user_token_model"`);
  }
}
