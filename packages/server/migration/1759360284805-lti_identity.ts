import { MigrationInterface, QueryRunner } from 'typeorm';

export class LtiIdentity1759360284805 implements MigrationInterface {
  name = 'LtiIdentity1759360284805';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_lti_identity_model" ("userId" integer NOT NULL, "issuer" text NOT NULL, "ltiUserId" text NOT NULL, "ltiEmail" text, CONSTRAINT "PK_5281ee786fb869bc6f2ded511d5" PRIMARY KEY ("userId", "issuer"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lti_identity_token_model" ("code" text NOT NULL, "issuer" text NOT NULL, "ltiUserId" text NOT NULL, "ltiEmail" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires" integer DEFAULT '600', CONSTRAINT "PK_a241acc007983e4ae6d123a2b51" PRIMARY KEY ("code"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_lti_identity_model" ADD CONSTRAINT "FK_56c87607379f94d13122c8363f5" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_lti_identity_model" DROP CONSTRAINT "FK_56c87607379f94d13122c8363f5"`,
    );
    await queryRunner.query(`DROP TABLE "lti_identity_token_model"`);
    await queryRunner.query(`DROP TABLE "user_lti_identity_model"`);
  }
}
