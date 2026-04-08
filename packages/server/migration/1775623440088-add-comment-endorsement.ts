import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommentEndorsement1775623440088 implements MigrationInterface {
    name = 'AddCommentEndorsement1775623440088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "async_question_comment_model" ADD "endorsedById" integer`);
        await queryRunner.query(`ALTER TABLE "async_question_comment_model" ADD CONSTRAINT "FK_0fa7c3f66a6c56c91d6c9df754e" FOREIGN KEY ("endorsedById") REFERENCES "user_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "async_question_comment_model" DROP CONSTRAINT "FK_0fa7c3f66a6c56c91d6c9df754e"`);
        await queryRunner.query(`ALTER TABLE "async_question_comment_model" DROP COLUMN "endorsedById"`);
    }

}
