import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPagesToLmsResourceTypes1752082815003
  implements MigrationInterface
{
  name = 'AddPagesToLmsResourceTypes1752082815003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lms_page_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "lmsSource" text NOT NULL, "title" text NOT NULL, "body" text NOT NULL, "url" text, "frontPage" boolean NOT NULL DEFAULT false, "modified" TIMESTAMP NOT NULL, "chatbotDocumentId" text, "uploaded" TIMESTAMP, "syncEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ca37c976a8662b7581f3d54a546" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" RENAME TO "lms_course_integration_model_selectedresourcetypes_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" AS ENUM('assignments', 'announcements', 'pages')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum"[] USING "selectedResourceTypes"::"text"::"public"."lms_course_integration_model_selectedresourcetypes_enum"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" SET DEFAULT '{assignments,announcements,pages}'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_page_model" ADD CONSTRAINT "FK_f2bafb453bf0b15c32907708e2f" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_page_model" DROP CONSTRAINT "FK_f2bafb453bf0b15c32907708e2f"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old" AS ENUM('assignments', 'announcements')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old"[] USING "selectedResourceTypes"::"text"::"public"."lms_course_integration_model_selectedresourcetypes_enum_old"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" SET DEFAULT '{assignments,announcements}'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old" RENAME TO "lms_course_integration_model_selectedresourcetypes_enum"`,
    );
    await queryRunner.query(`DROP TABLE "lms_page_model"`);
  }
}
