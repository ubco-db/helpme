import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFilesToLmsResourceTypes1752774315033
  implements MigrationInterface
{
  name = 'AddFilesToLmsResourceTypes1752774315033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lms_file_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "lmsSource" text NOT NULL, "name" text NOT NULL, "url" text NOT NULL, "contentType" text NOT NULL, "size" bigint NOT NULL, "modified" TIMESTAMP NOT NULL, "chatbotDocumentId" text, "uploaded" TIMESTAMP, "syncEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_3bcc14ab766f072dfbb68866cf2" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" RENAME TO "lms_course_integration_model_selectedresourcetypes_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" AS ENUM('assignments', 'announcements', 'pages', 'files')`,
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
      `ALTER TABLE "lms_file_model" ADD CONSTRAINT "FK_70ce290b867fb527b6a431ae1a2" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_file_model" DROP CONSTRAINT "FK_70ce290b867fb527b6a431ae1a2"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old" AS ENUM('assignments', 'announcements', 'pages')`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old"[] USING "selectedResourceTypes"::"text"::"public"."lms_course_integration_model_selectedresourcetypes_enum_old"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "lms_course_integration_model" ALTER COLUMN "selectedResourceTypes" SET DEFAULT '{assignments,announcements,pages}'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old" RENAME TO "lms_course_integration_model_selectedresourcetypes_enum"`,
    );
    await queryRunner.query(`DROP TABLE "lms_file_model"`);
  }
}
