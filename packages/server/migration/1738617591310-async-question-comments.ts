import { MigrationInterface, QueryRunner } from 'typeorm';

export class asyncQuestionComments1738617591310 implements MigrationInterface {
  name = 'asyncQuestionComments1738617591310';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "async_question_comment_model" ("id" SERIAL NOT NULL, "commentText" text NOT NULL, "createdAt" TIMESTAMP NOT NULL, "creatorId" integer NOT NULL, "questionId" integer NOT NULL, CONSTRAINT "PK_e20d8df1931b3040b53976bf8cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" DROP COLUMN "content"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."mail_services_servicetype_enum" RENAME TO "mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted', 'async_question_new_comment_on_my_post', 'async_question_new_comment_on_others_post')`,
    );
    await queryRunner.query(
      `ALTER TABLE "mail_services" ALTER COLUMN "serviceType" TYPE "public"."mail_services_servicetype_enum" USING "serviceType"::"text"::"public"."mail_services_servicetype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."mail_services_servicetype_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ALTER COLUMN "isSubscribed" SET DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" ADD CONSTRAINT "FK_704c9ee099b045378ba070ae153" FOREIGN KEY ("creatorId") REFERENCES "user_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" ADD CONSTRAINT "FK_a0636096f564ebf3e4dbdb9cb0b" FOREIGN KEY ("questionId") REFERENCES "async_question_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" DROP CONSTRAINT "FK_a0636096f564ebf3e4dbdb9cb0b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" DROP CONSTRAINT "FK_704c9ee099b045378ba070ae153"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ALTER COLUMN "isSubscribed" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mail_services_servicetype_enum_old" AS ENUM('async_question_human_answered', 'async_question_flagged', 'async_question_status_changed', 'async_question_upvoted')`,
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
      `ALTER TABLE "mail_services" ADD "content" character varying NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "async_question_comment_model"`);
  }
}
