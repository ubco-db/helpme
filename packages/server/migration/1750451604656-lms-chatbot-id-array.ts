import { MigrationInterface, QueryRunner } from 'typeorm';

export class LmsChatbotIdArray1750451604656 implements MigrationInterface {
  name = 'LmsChatbotIdArray1750451604656';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "lms_assignment_model" ADD "chatbotDocumentIds" text array NOT NULL DEFAULT '{}';
            UPDATE "lms_assignment_model" SET "chatbotDocumentIds" = ARRAY(SELECT "chatbotDocumentId" FROM "lms_assignment_model" AS "inner" WHERE "inner"."id" = "lms_assignment_model"."id");
            ALTER TABLE "lms_assignment_model" DROP COLUMN "chatbotDocumentId";

            ALTER TABLE "lms_announcement_model" ADD "chatbotDocumentIds" text array NOT NULL DEFAULT '{}';
            UPDATE "lms_announcement_model" SET "chatbotDocumentIds" = ARRAY(SELECT "chatbotDocumentId" FROM "lms_announcement_model" AS "inner" WHERE "inner"."id" = "lms_announcement_model"."id");
            ALTER TABLE "lms_announcement_model" DROP COLUMN "chatbotDocumentId";
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "lms_assignment_model" ADD "chatbotDocumentId" text;
            UPDATE "lms_assignment_model" SET "chatbotDocumentId" = "chatbotDocumentIds"[1];
            ALTER TABLE "lms_assignment_model" DROP COLUMN "chatbotDocumentIds";

            ALTER TABLE "lms_announcement_model" ADD "chatbotDocumentId" text;
            UPDATE "lms_announcement_model" SET "chatbotDocumentId" = "chatbotDocumentIds"[1];
            ALTER TABLE "lms_announcement_model" DROP COLUMN "chatbotDocumentIds";
        `);
  }
}
