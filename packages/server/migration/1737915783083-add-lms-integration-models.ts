import { MigrationInterface, QueryRunner } from 'typeorm';

export class addLmsIntegrationModels1737915783083
  implements MigrationInterface
{
  name = 'addLmsIntegrationModels1737915783083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lms_api_platform_enum" AS ENUM('Canvas')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_assignment_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "lmsSource" "public"."lms_api_platform_enum" NOT NULL, "name" text NOT NULL, "description" text NOT NULL DEFAULT '', "due" TIMESTAMP, "modified" TIMESTAMP NOT NULL, "chatbotDocumentId" text NOT NULL, "uploaded" TIMESTAMP NOT NULL, CONSTRAINT "PK_632eb1b1362c2e5d805db6ea013" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_announcement_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "lmsSource" "public"."lms_api_platform_enum" NOT NULL, "title" text NOT NULL, "message" text NOT NULL, "posted" TIMESTAMP NOT NULL, "modified" TIMESTAMP NOT NULL, "chatbotDocumentId" text NOT NULL, "uploaded" TIMESTAMP NOT NULL, CONSTRAINT "PK_e7f4f6a5247a4f577585d84bbfa" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_course_integration_model" ("courseId" integer NOT NULL, "apiCourseId" text NOT NULL, "apiKey" text NOT NULL, "apiKeyExpiry" TIMESTAMP, "lmsSynchronize" boolean NOT NULL DEFAULT false, "orgIntegrationOrganizationId" integer, "orgIntegrationApiPlatform" "public"."lms_api_platform_enum", CONSTRAINT "REL_594c79fce72d04560c3a4465ea" UNIQUE ("courseId"), CONSTRAINT "PK_594c79fce72d04560c3a4465ea6" PRIMARY KEY ("courseId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_org_integration_model" ("organizationId" integer NOT NULL, "apiPlatform" "public"."lms_api_platform_enum" NOT NULL, "rootUrl" text NOT NULL, CONSTRAINT "PK_8f17bd650afb1438b091dfde758" PRIMARY KEY ("organizationId", "apiPlatform"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" ADD CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" ADD CONSTRAINT "FK_dc5e29602b03151c340c596f7ae" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_2e982df9a28eed15d2c97b313d2" FOREIGN KEY ("orgIntegrationOrganizationId", "orgIntegrationApiPlatform") REFERENCES "lms_org_integration_model"("organizationId","apiPlatform") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ADD CONSTRAINT "FK_594c79fce72d04560c3a4465ea6" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" ADD CONSTRAINT "FK_0572ee7b5af9b49e69258079edd" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_org_integration_model" DROP CONSTRAINT "FK_0572ee7b5af9b49e69258079edd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_594c79fce72d04560c3a4465ea6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" DROP CONSTRAINT "FK_2e982df9a28eed15d2c97b313d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_announcement_model" DROP CONSTRAINT "FK_dc5e29602b03151c340c596f7ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_assignment_model" DROP CONSTRAINT "FK_3aee17cf9fc085e98b2b8607071"`,
    );
    await queryRunner.query(`DROP TABLE "lms_org_integration_model"`);
    await queryRunner.query(`DROP TABLE "lms_course_integration_model"`);
    await queryRunner.query(`DROP TABLE "lms_announcement_model"`);
    await queryRunner.query(`DROP TABLE "lms_assignment_model"`);
    await queryRunner.query(`DROP TYPE "public"."lms_api_platform_enum"`);
  }
}
