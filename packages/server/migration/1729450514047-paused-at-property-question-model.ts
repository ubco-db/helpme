import { MigrationInterface, QueryRunner } from 'typeorm';

export class pausedAtPropertyQuestionModel1729450514047
  implements MigrationInterface
{
  name = 'pausedAtPropertyQuestionModel1729450514047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_model" ADD "pausedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "question_model" DROP COLUMN "pausedAt"`,
    );
  }
}
