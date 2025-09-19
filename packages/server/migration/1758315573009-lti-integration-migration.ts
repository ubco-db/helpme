import { MigrationInterface, QueryRunner } from 'typeorm';

export class LtiIntegrationMigration1758315573009
  implements MigrationInterface
{
  name = 'LtiIntegrationMigration1758315573009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP CONSTRAINT "FK_704c0609206d9a92e7d1fe74f23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" DROP CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_access_token_model" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "iv" text, "data" text, "encryptedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organizationIntegrationOrganizationId" integer, "organizationIntegrationApiPlatform" text, CONSTRAINT "PK_85d54237f03acd8efeea453806d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_auth_state_model" ("state" text NOT NULL, "redirectUrl" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresIn" integer NOT NULL DEFAULT '60', "userId" integer NOT NULL, "organizationIntegrationOrganizationId" integer, "organizationIntegrationApiPlatform" text, CONSTRAINT "PK_7987b1c707a75215164c3e09f87" PRIMARY KEY ("state"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_state_model" ("state" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresIn" integer NOT NULL DEFAULT '60', "organizationId" integer NOT NULL, CONSTRAINT "PK_df8e02b34ca91e9b1ce1ba196a8" PRIMARY KEY ("state"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_invite_model" ("inviteCode" text NOT NULL, "courseId" integer NOT NULL, "email" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "expires" integer DEFAULT '600', CONSTRAINT "PK_21a0bd712887650899e25fd3c1a" PRIMARY KEY ("inviteCode", "courseId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP CONSTRAINT "UQ_704c0609206d9a92e7d1fe74f23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" DROP COLUMN "organizationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP COLUMN "expires_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD "accessTokenId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD "secure" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD "clientId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD "clientSecret" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_settings_model" ADD "allowLMSApiKey" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD "expiresIn" integer NOT NULL DEFAULT '86400'`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "apiKey" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_access_token_model" ADD CONSTRAINT "FK_20bb76132c669d636aa7f57a3e1" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_access_token_model" ADD CONSTRAINT "FK_e3512c534a48f756eb5ff600534" FOREIGN KEY ("organizationIntegrationOrganizationId", "organizationIntegrationApiPlatform") REFERENCES "lms_org_integration_model"("organizationId","apiPlatform") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_5049065fef3f3755f3c7860dcf9" FOREIGN KEY ("accessTokenId") REFERENCES "lms_access_token_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_auth_state_model" ADD CONSTRAINT "FK_51d858bc996c17c90ef0a1c7e26" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_auth_state_model" ADD CONSTRAINT "FK_36498bbcefa4bbc8f987622d563" FOREIGN KEY ("organizationIntegrationOrganizationId", "organizationIntegrationApiPlatform") REFERENCES "lms_org_integration_model"("organizationId","apiPlatform") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_state_model" ADD CONSTRAINT "FK_d9e48ea4f6e645155cc6a67e7bd" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_invite_model" ADD CONSTRAINT "FK_7b666e9a4e1f6c8c35615fea1f2" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_invite_model" DROP CONSTRAINT "FK_7b666e9a4e1f6c8c35615fea1f2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP CONSTRAINT "FK_25c224ece4509a7a4582357605f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" DROP CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_state_model" DROP CONSTRAINT "FK_d9e48ea4f6e645155cc6a67e7bd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_auth_state_model" DROP CONSTRAINT "FK_36498bbcefa4bbc8f987622d563"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_auth_state_model" DROP CONSTRAINT "FK_51d858bc996c17c90ef0a1c7e26"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_5049065fef3f3755f3c7860dcf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_access_token_model" DROP CONSTRAINT "FK_e3512c534a48f756eb5ff600534"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_access_token_model" DROP CONSTRAINT "FK_20bb76132c669d636aa7f57a3e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" DROP CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "apiKey" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP COLUMN "expiresIn"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" DROP COLUMN "createdAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_settings_model" DROP COLUMN "allowLMSApiKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP COLUMN "clientSecret"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP COLUMN "clientId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP COLUMN "secure"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP COLUMN "accessTokenId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD "created_at" bigint NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD "expires_at" bigint NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD "organizationId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD CONSTRAINT "UQ_704c0609206d9a92e7d1fe74f23" UNIQUE ("organizationId")`,
    );
    await queryRunner.query(`DROP TABLE "course_invite_model"`);
    await queryRunner.query(`DROP TABLE "auth_state_model"`);
    await queryRunner.query(`DROP TABLE "lms_auth_state_model"`);
    await queryRunner.query(`DROP TABLE "lms_access_token_model"`);
    await queryRunner.query(
      `ALTER TABLE "user_token_model" ADD CONSTRAINT "FK_25c224ece4509a7a4582357605f" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user_model" ADD CONSTRAINT "FK_d76bf27825067e1e6f83d7913fc" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_model" ADD CONSTRAINT "FK_704c0609206d9a92e7d1fe74f23" FOREIGN KEY ("organizationId") REFERENCES "organization_chatbot_settings_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_course_model" ADD CONSTRAINT "FK_80faf01af81ddc3f4c17b6b6614" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
