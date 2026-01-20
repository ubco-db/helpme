import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotDatabaseUpdatesII1767985902172 implements MigrationInterface {
  name = 'Test1767985902172';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" RENAME COLUMN "idHelpMeDB" TO "id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" RENAME COLUMN "docIdChatbotDB" TO "chatbotId"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."chatbot_doc_pdf_model_status_enum" AS ENUM('0', '1')`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" ADD "status" "public"."chatbot_doc_pdf_model_status_enum" NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "interactionId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ALTER COLUMN "courseId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c" FOREIGN KEY ("interactionId") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" DROP CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" DROP CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ALTER COLUMN "userId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ALTER COLUMN "courseId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2b01cc936a843e5efc73f9acf49" FOREIGN KEY ("userId") REFERENCES "user_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_interactions_model" ADD CONSTRAINT "FK_2d37ae2602e60432a4bf0c3cb19" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "interactionId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ADD CONSTRAINT "FK_797cfec9399d72f1b554d7cb56c" FOREIGN KEY ("interactionId") REFERENCES "chatbot_interactions_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."chatbot_doc_pdf_model_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" RENAME COLUMN "id" TO "idHelpMeDB"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" RENAME COLUMN "chatbotId" TO "docIdChatbotDB"`,
    );
  }
}
