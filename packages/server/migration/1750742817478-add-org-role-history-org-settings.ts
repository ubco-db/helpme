import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrgRoleHistoryOrgSettings1750742817478
  implements MigrationInterface
{
  name = 'AddOrgRoleHistoryOrgSettings1750742817478';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "organization_settings_model" ("organizationId" integer NOT NULL, "allowProfCourseCreate" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_81487e44dc90c03a092b7ac7e04" PRIMARY KEY ("organizationId"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_history_model_fromrole_enum" AS ENUM('member', 'admin', 'professor')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_history_model_torole_enum" AS ENUM('member', 'admin', 'professor')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_history_model_rolechangereason_enum" AS ENUM('manualModification', 'joinedOrganizationMember', 'joinedOrganizationProfessor', 'unknown')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role_history_model" ("id" SERIAL NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "fromRole" "public"."organization_role_history_model_fromrole_enum" DEFAULT 'member', "toRole" "public"."organization_role_history_model_torole_enum" DEFAULT 'member', "byOrgUserId" integer, "toOrgUserId" integer, "roleChangeReason" "public"."organization_role_history_model_rolechangereason_enum" NOT NULL DEFAULT 'unknown', "organizationId" integer, CONSTRAINT "PK_f583f08f7807b8c797cb125d758" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_settings_model" ADD CONSTRAINT "FK_81487e44dc90c03a092b7ac7e04" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ADD CONSTRAINT "FK_f9d466b746cd4d35478b02c4a50" FOREIGN KEY ("byOrgUserId") REFERENCES "organization_user_model"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ADD CONSTRAINT "FK_552d6a19a2f5375b478e996bf7b" FOREIGN KEY ("toOrgUserId") REFERENCES "organization_user_model"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" ADD CONSTRAINT "FK_3ea9aa75ee70fd49208269a0b5a" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" DROP CONSTRAINT "FK_3ea9aa75ee70fd49208269a0b5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" DROP CONSTRAINT "FK_552d6a19a2f5375b478e996bf7b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_history_model" DROP CONSTRAINT "FK_f9d466b746cd4d35478b02c4a50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_settings_model" DROP CONSTRAINT "FK_81487e44dc90c03a092b7ac7e04"`,
    );
    await queryRunner.query(`DROP TABLE "organization_role_history_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_history_model_rolechangereason_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_history_model_torole_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_history_model_fromrole_enum"`,
    );
    await queryRunner.query(`DROP TABLE "organization_settings_model"`);
  }
}
