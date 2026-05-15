import { MigrationInterface, QueryRunner } from "typeorm";

export class EssayEvaluationEnabled1778520291992 implements MigrationInterface {
    name = 'EssayEvaluationEnabled1778520291992'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_settings_model" ADD "essayEvaluationEnabled" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "course_settings_model" DROP COLUMN "essayEvaluationEnabled"`);
    }

}
