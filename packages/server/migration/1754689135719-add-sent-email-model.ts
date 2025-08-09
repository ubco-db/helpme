import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSentEmailModel1754689135719 implements MigrationInterface {
  name = 'AddSentEmailModel1754689135719';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."sent_email_model_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post', 'course_clone_summary')`,
    );
    await queryRunner.query(
      `CREATE TABLE "sent_email_model" ("emailId" text NOT NULL, "subject" text NOT NULL, "accepted" text array NOT NULL DEFAULT '{}', "rejected" text array NOT NULL DEFAULT '{}', "metadata" jsonb NOT NULL DEFAULT '{}', "serviceType" "public"."sent_email_model_servicetype_enum" NOT NULL, CONSTRAINT "PK_02c068b1ab222c7e45bfc361fa8" PRIMARY KEY ("emailId"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "sent_email_model"`);
    await queryRunner.query(
      `DROP TYPE "public"."sent_email_model_servicetype_enum"`,
    );
  }
}
