import { MigrationInterface, QueryRunner } from 'typeorm';

export class questionTypesSoftDelete1726179810316
  implements MigrationInterface
{
  name = 'questionTypesSoftDelete1726179810316';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_document_model" DROP CONSTRAINT "FK_a175cc149f7941bf1663ce6c627"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_document_model" DROP COLUMN "question"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "deletedAt" TIMESTAMP`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "question_type_model" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_document_model" ADD "question" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_document_model" ADD CONSTRAINT "FK_a175cc149f7941bf1663ce6c627" FOREIGN KEY ("question") REFERENCES "chatbot_questions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
