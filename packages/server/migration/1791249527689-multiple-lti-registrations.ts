import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultipleLtiRegistrations1791249527689 implements MigrationInterface {
  name = 'MultipleLtiRegistrations1791249527689';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lti_organization_registration_model" ("ltiPlatformId" text NOT NULL, "organizationId" integer NOT NULL, "apiPlatform" text NOT NULL, CONSTRAINT "PK_636c3dda00b54af2419da309a82" PRIMARY KEY ("ltiPlatformId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "lti_organization_registration_model" ADD CONSTRAINT "FK_04410f60741e025d3c699e7af4c" FOREIGN KEY ("organizationId", "apiPlatform") REFERENCES "lms_org_integration_model"("organizationId","apiPlatform") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "lti_organization_registration_model" ("ltiPlatformId", "organizationId", "apiPlatform")
       SELECT "ltiPlatformId", "organizationId", "apiPlatform" FROM "lms_org_integration_model"
       WHERE "ltiPlatformId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP CONSTRAINT "UQ_bb3df6b55028b05540a07854950"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP COLUMN "ltiPlatformId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuse rollback while a scalar would lose an overlapping registration.
    await queryRunner.query(
      `DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM "lti_organization_registration_model"
          GROUP BY "organizationId", "apiPlatform" HAVING COUNT(*) > 1
        ) THEN
          RAISE EXCEPTION 'Unassign additional LTI registrations before rolling back to one registration per organization.';
        END IF;
      END $$`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD "ltiPlatformId" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD CONSTRAINT "UQ_bb3df6b55028b05540a07854950" UNIQUE ("ltiPlatformId")`,
    );
    await queryRunner.query(
      `UPDATE "lms_org_integration_model" integration
       SET "ltiPlatformId" = registration."ltiPlatformId"
       FROM "lti_organization_registration_model" registration
       WHERE integration."organizationId" = registration."organizationId"
         AND integration."apiPlatform" = registration."apiPlatform"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lti_organization_registration_model" DROP CONSTRAINT "FK_04410f60741e025d3c699e7af4c"`,
    );
    await queryRunner.query(`DROP TABLE "lti_organization_registration_model"`);
  }
}
