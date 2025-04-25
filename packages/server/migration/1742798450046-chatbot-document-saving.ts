import { MigrationInterface, QueryRunner } from 'typeorm';

export class chatbotDocumentSaving1742798450046 implements MigrationInterface {
  name = 'chatbotDocumentSaving1742798450046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chatbot_doc_pdf_model" ("idHelpMeDB" SERIAL NOT NULL, "docIdChatbotDB" text, "docName" text NOT NULL, "courseId" integer NOT NULL, "docData" bytea, "docSizeBytes" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_33dab2ab265d3754463818f5cf7" PRIMARY KEY ("idHelpMeDB"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "vectorStoreId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" ADD CONSTRAINT "FK_00a56a7a247266f4203601ec613" FOREIGN KEY ("courseId") REFERENCES "course_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chatbot_doc_pdf_model" DROP CONSTRAINT "FK_00a56a7a247266f4203601ec613"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chatbot_questions_model" ALTER COLUMN "vectorStoreId" DROP NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE "chatbot_doc_pdf_model"`);
  }
}
