import { MigrationInterface, QueryRunner } from 'typeorm';

export class fixQuestionTypes1710018390009 implements MigrationInterface {
  name = 'fixQuestionTypes1710018390009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "forAsync"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "forQueue"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "queueId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD CONSTRAINT "FK_897f039518143a412251b010e3f" FOREIGN KEY ("queueId") REFERENCES "queue_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP CONSTRAINT "FK_897f039518143a412251b010e3f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" DROP COLUMN "queueId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "forQueue" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "question_type_model" ADD "forAsync" boolean NOT NULL DEFAULT false`,
    );
  }
}
