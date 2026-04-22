import { MigrationInterface, QueryRunner } from 'typeorm';

export class IframeQuestionCriteriaRequired1776384901191
  implements MigrationInterface
{
  name = 'IframeQuestionCriteriaRequired1776384901191';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "iframe_question_model" SET "criteriaText" = '' WHERE "criteriaText" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "iframe_question_model" ALTER COLUMN "criteriaText" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "iframe_question_model" ALTER COLUMN "criteriaText" DROP NOT NULL`,
    );
  }
}
