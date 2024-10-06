import { MigrationInterface, QueryRunner } from 'typeorm';

export class addInsightDashboardModel1728201025560
  implements MigrationInterface
{
  name = 'addInsightDashboardModel1728201025560';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_document_model" DROP CONSTRAINT "FK_a175cc149f7941bf1663ce6c627"`,
    );
    await queryRunner.query(
      `CREATE TABLE "insight_dashboard_model" ("userCourseId" integer NOT NULL, "name" text NOT NULL, "insights" text NOT NULL DEFAULT '{}', CONSTRAINT "dashboardKey" UNIQUE ("name", "userCourseId"), CONSTRAINT "PK_c5973ea9aade467a0d46aad78f5" PRIMARY KEY ("userCourseId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_document_model" DROP COLUMN "question"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD "isPreviousQuestion" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum" RENAME TO "mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" ADD CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5" FOREIGN KEY ("userCourseId") REFERENCES "user_course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "insight_dashboard_model" DROP CONSTRAINT "FK_c5973ea9aade467a0d46aad78f5"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum_old" AS ENUM('async_question_human_answered', 'async_question_flagged')`,
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
      `ALTER TABLE "chatbot_questions_model" DROP COLUMN "isPreviousQuestion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_document_model" ADD "question" integer`,
    );
    await queryRunner.query(`DROP TABLE "insight_dashboard_model"`);
    await queryRunner.query(
      `ALTER TABLE "question_document_model" ADD CONSTRAINT "FK_a175cc149f7941bf1663ce6c627" FOREIGN KEY ("question") REFERENCES "chatbot_questions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
