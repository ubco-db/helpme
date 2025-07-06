import { MigrationInterface, QueryRunner } from 'typeorm';

export class SemesterModelSuperCourse1749150892621
  implements MigrationInterface
{
  name = 'SemesterModelSuperCourse1749150892621';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "super_course_model" ("id" SERIAL NOT NULL, "name" text NOT NULL, "organizationId" integer NOT NULL, CONSTRAINT "PK_8482492e21ce6f30370f3b63141" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."semester_model_color_enum" AS ENUM('blue', 'gold', 'green', 'purple', 'red', 'orange', 'yellow', 'lime', 'cyan', 'geekblue', 'magenta', 'volcano', 'blue-inverse', 'gold-inverse', 'green-inverse', 'purple-inverse', 'red-inverse', 'orange-inverse', 'yellow-inverse', 'lime-inverse', 'cyan-inverse', 'geekblue-inverse', 'magenta-inverse', 'volcano-inverse', 'success', 'processing', 'error', 'default', 'warning')`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ADD "color" "public"."semester_model_color_enum" NOT NULL DEFAULT 'blue'`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD "superCourseId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "description" SET DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum" RENAME TO "mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_model" ADD CONSTRAINT "FK_157f7e636405e72bfb127e12769" FOREIGN KEY ("organizationId") REFERENCES "organization_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" ADD CONSTRAINT "FK_e14a9e2f182848bb9069989d7bb" FOREIGN KEY ("superCourseId") REFERENCES "super_course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP CONSTRAINT "FK_e14a9e2f182848bb9069989d7bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "super_course_model" DROP CONSTRAINT "FK_157f7e636405e72bfb127e12769"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum_old" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum_old" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum_old" RENAME TO "mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "semester_model" ALTER COLUMN "description" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_model" DROP COLUMN "superCourseId"`,
    );
    await queryRunner.query(`ALTER TABLE "semester_model" DROP COLUMN "color"`);
    await queryRunner.query(`DROP TYPE "public"."semester_model_color_enum"`);
    await queryRunner.query(`DROP TABLE "super_course_model"`);
  }
}
