import { MigrationInterface, QueryRunner } from 'typeorm';

export class addCommentEndorsement1773057600000 implements MigrationInterface {
  name = 'addCommentEndorsement1773057600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" ADD "endorsedById" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" ADD CONSTRAINT "FK_async_question_comment_endorsedBy" FOREIGN KEY ("endorsedById") REFERENCES "user_model"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" DROP CONSTRAINT "FK_async_question_comment_endorsedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "async_question_comment_model" DROP COLUMN "endorsedById"`,
    );
  }
}
