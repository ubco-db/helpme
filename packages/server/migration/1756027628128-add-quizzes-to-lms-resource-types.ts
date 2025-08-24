import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuizzesToLmsResourceTypes1756027628128
  implements MigrationInterface
{
  name = 'AddQuizzesToLmsResourceTypes1756027628128';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."lms_quiz_model_accesslevel_enum" AS ENUM('logistics_only', 'logistics_and_questions', 'logistics_questions_general_comments', 'full_access')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lms_quiz_model" ("id" integer NOT NULL, "courseId" integer NOT NULL, "lmsSource" text NOT NULL, "title" text NOT NULL, "description" text, "due" TIMESTAMP, "unlock" TIMESTAMP, "lock" TIMESTAMP, "timeLimit" integer, "allowedAttempts" integer, "questions" jsonb, "modified" TIMESTAMP NOT NULL, "accessLevel" "public"."lms_quiz_model_accesslevel_enum" NOT NULL DEFAULT 'logistics_only', "chatbotDocumentId" text, "uploaded" TIMESTAMP, "syncEnabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_704637485df0a069c217aaaf61a" PRIMARY KEY ("id", "courseId"))`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" RENAME TO "lms_course_integration_model_selectedresourcetypes_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum" AS ENUM('assignments', 'announcements', 'pages', 'files', 'quizzes')`,
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
      `ALTER TABLE "lms_quiz_model" ADD CONSTRAINT "FK_a1fc6aaad49b5fb4045f28d1d49" FOREIGN KEY ("courseId") REFERENCES "lms_course_integration_model"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lms_quiz_model" DROP CONSTRAINT "FK_a1fc6aaad49b5fb4045f28d1d49"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lms_course_integration_model_selectedresourcetypes_enum_old" AS ENUM('assignments', 'announcements', 'pages', 'files')`,
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
    await queryRunner.query(`DROP TABLE "lms_quiz_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."lms_quiz_model_accesslevel_enum"`,
    );
  }
}
