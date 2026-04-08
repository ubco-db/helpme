import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEndorsedCommentCount1775678388611 implements MigrationInterface {
    name = 'AddEndorsedCommentCount1775678388611'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_course_model" ADD "endorsedCommentCount" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_course_model" DROP COLUMN "endorsedCommentCount"`);
    }

}
